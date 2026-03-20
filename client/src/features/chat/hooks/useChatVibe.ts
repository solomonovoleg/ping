import { useState, useEffect, useRef, useCallback } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { CHAT_VIBE_PREFS_CHANGED } from "@/lib/chat-vibe-prefs";
import { onChatVibeUpdate, type ChatVibeUpdateDetail } from "../realtime-events";
import { getClientVibeTokens } from "@/lib/chat-vibe-themes";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { VibeThemeCode, VibeThemeTokens } from "@shared/chat-vibe-types";

export type ChatVibeState = {
  theme: VibeThemeCode;
  tokens: VibeThemeTokens;
  isActive: boolean;
  confidence: number;
  visualIntensity: number;
};

const DEFAULT_STATE: ChatVibeState = {
  theme: "casual",
  tokens: getClientVibeTokens("casual"),
  isActive: false,
  confidence: 0,
  visualIntensity: 0,
};

export function useChatVibe(chatId: string | undefined): ChatVibeState {
  const [state, setState] = useState<ChatVibeState>(DEFAULT_STATE);
  const [prefsEpoch, setPrefsEpoch] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLElement | null>(null);

  const applyTokensToCSS = useCallback(
    (tokens: VibeThemeTokens, active: boolean) => {
      const root = document.documentElement;
      if (!active) {
        root.style.setProperty("--chat-vibe-bg-tint", "transparent");
        root.style.setProperty("--chat-vibe-bubble-in", "transparent");
        root.style.setProperty("--chat-vibe-bubble-out", "transparent");
        root.style.setProperty("--chat-vibe-accent", "transparent");
        root.style.setProperty("--chat-vibe-overlay-opacity", "0");
        return;
      }
      const scale = getIntensityScale();
      root.style.setProperty("--chat-vibe-bg-tint", scaleAlpha(tokens.backgroundTint, scale));
      root.style.setProperty("--chat-vibe-bubble-in", scaleAlpha(tokens.bubbleIncoming, scale));
      root.style.setProperty("--chat-vibe-bubble-out", scaleAlpha(tokens.bubbleOutgoing, scale));
      root.style.setProperty("--chat-vibe-accent", scaleAlpha(tokens.accentGlow, scale));
      root.style.setProperty(
        "--chat-vibe-overlay-opacity",
        String(Math.round(tokens.overlayOpacity * scale * 100) / 100),
      );
    },
    [],
  );

  useEffect(() => {
    const onPrefs = () => setPrefsEpoch((n) => n + 1);
    window.addEventListener(CHAT_VIBE_PREFS_CHANGED, onPrefs);
    return () => window.removeEventListener(CHAT_VIBE_PREFS_CHANGED, onPrefs);
  }, []);

  useEffect(() => {
    if (!chatId) {
      setState(DEFAULT_STATE);
      applyTokensToCSS(DEFAULT_STATE.tokens, false);
      return;
    }

    let cancelled = false;

    apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/vibe`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 304) {
          // Keep current vibe state: 304 means "not modified", not "disabled".
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
          setState(DEFAULT_STATE);
          applyTokensToCSS(DEFAULT_STATE.tokens, false);
          return;
        }

        const theme = (data.theme ?? "casual") as VibeThemeCode;
        const tokens = data.tokens
          ? mergeTokens(getClientVibeTokens(theme), data.tokens)
          : getClientVibeTokens(theme);

        const newState: ChatVibeState = {
          theme,
          tokens,
          isActive: true,
          confidence: data.confidence ?? 0,
          visualIntensity: data.visualIntensity ?? 0,
        };
        setState(newState);
        applyTokensToCSS(tokens, true);
      })
      .catch(() => {
        if (!cancelled) {
          setState(DEFAULT_STATE);
          applyTokensToCSS(DEFAULT_STATE.tokens, false);
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
      const base = getClientVibeTokens(theme);
      const tokens = detail.tokens ? mergeTokens(base, detail.tokens) : base;

      const newState: ChatVibeState = {
        theme,
        tokens,
        isActive: true,
        confidence: detail.confidence ?? 0,
        visualIntensity: detail.visualIntensity ?? 0,
      };
      setState(newState);
      applyTokensToCSS(tokens, true);
    });

    return unsub;
  }, [chatId, applyTokensToCSS]);

  useEffect(() => {
    return () => {
      applyTokensToCSS(DEFAULT_STATE.tokens, false);
    };
  }, [applyTokensToCSS]);

  return state;
}

function scaleAlpha(color: string, scale: number): string {
  if (color === "transparent" || !color) return "transparent";
  const rgbaMatch = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (rgbaMatch) {
    const a = parseFloat(rgbaMatch[4] ?? "1") * scale;
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
    ...(typeof override.bubbleIncoming === "string" && { bubbleIncoming: override.bubbleIncoming }),
    ...(typeof override.bubbleOutgoing === "string" && { bubbleOutgoing: override.bubbleOutgoing }),
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
