import { useState, useEffect, useRef, useCallback } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { DURATION_CHAT_VIBE_CROSSFADE_MS, DURATION_FAST_MS, getPrefersReducedMotion } from "@/lib/motion";
import { CHAT_VIBE_PREFS_CHANGED } from "@/lib/chat-vibe-prefs";
import { onChatVibeUpdate, type ChatVibeUpdateDetail } from "../realtime-events";
import { getClientVibeTokens, type ChatVibeSurface } from "@/lib/chat-vibe-themes";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import type { VibeThemeCode, VibeThemeTokens } from "@shared/chat-vibe-types";

export type ChatVibeState = {
  theme: VibeThemeCode;
  tokens: VibeThemeTokens;
  isActive: boolean;
  confidence: number;
  visualIntensity: number;
};

function defaultState(surface: ChatVibeSurface): ChatVibeState {
  return {
    theme: "casual",
    tokens: getClientVibeTokens("casual", surface),
    isActive: false,
    confidence: 0,
    visualIntensity: 0,
  };
}

export type UseChatVibeOptions = {
  surface?: ChatVibeSurface;
};

export function useChatVibe(chatId: string | undefined, options: UseChatVibeOptions = {}): ChatVibeState {
  const surface = options.surface ?? "dark";
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const [state, setState] = useState<ChatVibeState>(() => defaultState(surface));
  const [prefsEpoch, setPrefsEpoch] = useState(0);
  const serverOverrideRef = useRef<Record<string, string | number> | null>(null);
  const hapticStateRef = useRef<{ theme: VibeThemeCode; visualIntensity: number; isActive: boolean } | null>(null);

  const applyTokensToCSS = useCallback(
    (tokens: VibeThemeTokens, active: boolean) => {
      const root = document.documentElement;
      const tokenTransitionMs = getPrefersReducedMotion()
        ? DURATION_FAST_MS
        : DURATION_CHAT_VIBE_CROSSFADE_MS;
      if (!active) {
        root.style.setProperty("--chat-vibe-token-transition", `${DURATION_FAST_MS}ms`);
        root.style.setProperty("--chat-vibe-bg-tint", "transparent");
        root.style.setProperty("--chat-vibe-bubble-in", "transparent");
        root.style.setProperty("--chat-vibe-bubble-out", "transparent");
        root.style.setProperty("--chat-vibe-accent", "transparent");
        root.style.setProperty("--chat-vibe-overlay-opacity", "0");
        return;
      }
      root.style.setProperty("--chat-vibe-token-transition", `${tokenTransitionMs}ms`);
      const scale = getIntensityScale();
      // Пузыри: на «низкой» интенсивности иначе rgba-альфа входящих почти нулевая — вайб незаметен.
      const bubbleScale = Math.max(scale, 0.78);
      const outgoingMinAlpha = surfaceRef.current === "light" ? 0.7 : 0.62;
      root.style.setProperty("--chat-vibe-bg-tint", scaleAlpha(tokens.backgroundTint, scale));
      root.style.setProperty("--chat-vibe-bubble-in", scaleAlpha(tokens.bubbleIncoming, bubbleScale));
      /* Исходящий: не даём альфе упасть слишком низко — иначе «белый» текст на почти белом фоне в светлом чате */
      root.style.setProperty(
        "--chat-vibe-bubble-out",
        scaleAlpha(tokens.bubbleOutgoing, bubbleScale, { minAlpha: outgoingMinAlpha }),
      );
      root.style.setProperty("--chat-vibe-accent", scaleAlpha(tokens.accentGlow, scale));
      root.style.setProperty(
        "--chat-vibe-overlay-opacity",
        String(Math.round(tokens.overlayOpacity * scale * 100) / 100),
      );
    },
    [],
  );

  const maybePulseVibeHaptic = useCallback((nextState: ChatVibeState) => {
    const prev = hapticStateRef.current;
    hapticStateRef.current = {
      theme: nextState.theme,
      visualIntensity: nextState.visualIntensity ?? 0,
      isActive: nextState.isActive,
    };
    if (!prev || !prev.isActive || !nextState.isActive) return;

    const prevIntensity = prev.visualIntensity ?? 0;
    const nextIntensity = nextState.visualIntensity ?? 0;
    const diff = Math.abs(nextIntensity - prevIntensity);
    const steppedUp = nextIntensity > prevIntensity;
    const themeChanged = prev.theme !== nextState.theme;
    const becameNoticeable = prevIntensity === 0 && nextIntensity >= 1;
    if ((steppedUp && (themeChanged || diff >= 2)) || becameNoticeable) {
      triggerSelectionHaptic();
    }
  }, []);

  useEffect(() => {
    const onPrefs = () => setPrefsEpoch((n) => n + 1);
    window.addEventListener(CHAT_VIBE_PREFS_CHANGED, onPrefs);
    return () => window.removeEventListener(CHAT_VIBE_PREFS_CHANGED, onPrefs);
  }, []);

  useEffect(() => {
    setState((prev) => (prev.isActive ? prev : defaultState(surface)));
  }, [surface]);

  useEffect(() => {
    if (!chatId) {
      serverOverrideRef.current = null;
      hapticStateRef.current = { theme: "casual", visualIntensity: 0, isActive: false };
      const next = defaultState(surfaceRef.current);
      setState(next);
      applyTokensToCSS(next.tokens, false);
      return;
    }

    let cancelled = false;

    apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/vibe`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 304) {
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          active?: boolean;
          theme?: string;
          tokens?: Record<string, string | number>;
          confidence?: number;
          visualIntensity?: number;
        };
        if (cancelled) return;
        if (!res.ok || data.active !== true) {
          serverOverrideRef.current = null;
          hapticStateRef.current = { theme: "casual", visualIntensity: 0, isActive: false };
          /* База: премиум-чёрный / светлый фон без узоров; атмосфера (паттерны, тинты) только при active с сервера */
          const next = defaultState(surfaceRef.current);
          setState(next);
          applyTokensToCSS(next.tokens, false);
          return;
        }

        const theme = (data.theme ?? "casual") as VibeThemeCode;
        serverOverrideRef.current = data.tokens && typeof data.tokens === "object" ? data.tokens : null;
        const tokens = mergeTokens(
          getClientVibeTokens(theme, surfaceRef.current),
          serverOverrideRef.current ?? {},
        );

        const newState: ChatVibeState = {
          theme,
          tokens,
          isActive: true,
          confidence: data.confidence ?? 0,
          visualIntensity: data.visualIntensity ?? 0,
        };
        maybePulseVibeHaptic(newState);
        setState(newState);
        applyTokensToCSS(tokens, true);
      })
      .catch(() => {
        if (!cancelled) {
          serverOverrideRef.current = null;
          hapticStateRef.current = { theme: "casual", visualIntensity: 0, isActive: false };
          const next = defaultState(surfaceRef.current);
          setState(next);
          applyTokensToCSS(next.tokens, false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, prefsEpoch, applyTokensToCSS]);

  useEffect(() => {
    if (!chatId) return;

    const unsub = onChatVibeUpdate((detail: ChatVibeUpdateDetail) => {
      if (detail.chatId !== chatId) return;

      const theme = (detail.theme ?? "casual") as VibeThemeCode;
      if (detail.tokens && typeof detail.tokens === "object") {
        serverOverrideRef.current = detail.tokens;
      }
      const base = getClientVibeTokens(theme, surface);
      const tokens = mergeTokens(base, serverOverrideRef.current ?? {});

      const newState: ChatVibeState = {
        theme,
        tokens,
        isActive: true,
        confidence: detail.confidence ?? 0,
        visualIntensity: detail.visualIntensity ?? 0,
      };
      maybePulseVibeHaptic(newState);
      setState(newState);
      applyTokensToCSS(tokens, true);
    });

    return unsub;
  }, [chatId, surface, applyTokensToCSS, maybePulseVibeHaptic]);

  useEffect(() => {
    if (!chatId || !state.isActive) return;
    const merged = mergeTokens(
      getClientVibeTokens(state.theme, surface),
      serverOverrideRef.current ?? {},
    );
    setState((prev) => (prev.isActive ? { ...prev, tokens: merged } : prev));
    applyTokensToCSS(merged, true);
  }, [surface, chatId, state.isActive, state.theme, applyTokensToCSS]);

  useEffect(() => {
    return () => {
      applyTokensToCSS(defaultState("dark").tokens, false);
    };
  }, [applyTokensToCSS]);

  return state;
}

function scaleAlpha(color: string, scale: number, opts?: { minAlpha?: number }): string {
  if (color === "transparent" || !color) return "transparent";
  const rgbaMatch = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (rgbaMatch) {
    let a = parseFloat(rgbaMatch[4] ?? "1") * scale;
    if (opts?.minAlpha != null && Number.isFinite(a)) {
      a = Math.max(opts.minAlpha, Math.min(1, a));
    }
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${Math.round(a * 1000) / 1000})`;
  }
  return color;
}

function mergeTokens(
  base: VibeThemeTokens,
  override: Record<string, string | number>,
): VibeThemeTokens {
  return {
    ...base,
    ...(typeof override.backgroundTint === "string" && { backgroundTint: override.backgroundTint }),
    // Пузыри — только с клиента (getClientVibeTokens по light/dark). Серверные токены были почти одинаковые
    // для in/out и затирали контраст как у PULSE (светлый входящий / насыщенный исходящий).
    ...(typeof override.accentGlow === "string" && { accentGlow: override.accentGlow }),
    ...(typeof override.overlayType === "string" && {
      overlayType: override.overlayType as VibeThemeTokens["overlayType"],
    }),
    ...(typeof override.overlayOpacity === "number" && { overlayOpacity: override.overlayOpacity }),
    ...(typeof override.animationPreset === "string" && {
      animationPreset: override.animationPreset as VibeThemeTokens["animationPreset"],
    }),
  };
}
