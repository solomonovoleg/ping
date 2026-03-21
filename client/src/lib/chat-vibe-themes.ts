import type { VibeThemeCode, VibeThemeTokens } from "@shared/chat-vibe-types";

/** Акцент темы — кольцо у аватара, SVG-паттерны (как в PULSE MobileChat) */
export const PULSE_THEME_ACCENTS: Record<VibeThemeCode, string> = {
  casual: "#818cf8",
  romantic: "#f472b6",
  business: "#60a5fa",
  conflict: "#f87171",
  fun: "#fb923c",
  relax: "#2dd4bf",
  support: "#c084fc",
  gaming: "#4ade80",
};

/** Токены под светлую поверхность чата (MobileChatLight MOODS) */
const pulseLight: Record<VibeThemeCode, VibeThemeTokens> = {
  casual: {
    backgroundTint: "rgba(99,102,241,0.12)",
    bubbleIncoming: "#ffffff",
    bubbleOutgoing: "#6366f1",
    accentGlow: "rgba(99,102,241,0.3)",
    overlayType: "none",
    overlayOpacity: 0,
    animationPreset: "calm",
  },
  romantic: {
    backgroundTint: "rgba(236,72,153,0.14)",
    bubbleIncoming: "#fff5f9",
    bubbleOutgoing: "#db2777",
    accentGlow: "rgba(236,72,153,0.32)",
    overlayType: "hearts",
    overlayOpacity: 0.06,
    animationPreset: "romantic",
  },
  business: {
    backgroundTint: "rgba(37,99,235,0.12)",
    bubbleIncoming: "#f0f5ff",
    bubbleOutgoing: "#1d4ed8",
    accentGlow: "rgba(37,99,235,0.28)",
    overlayType: "grid",
    overlayOpacity: 0.05,
    animationPreset: "strict",
  },
  conflict: {
    backgroundTint: "rgba(220,38,38,0.12)",
    bubbleIncoming: "#fff8f8",
    bubbleOutgoing: "#b91c1c",
    accentGlow: "rgba(220,38,38,0.28)",
    overlayType: "none",
    overlayOpacity: 0,
    animationPreset: "tense",
  },
  fun: {
    backgroundTint: "rgba(234,88,12,0.12)",
    bubbleIncoming: "#fffaf0",
    bubbleOutgoing: "#c2410c",
    accentGlow: "rgba(234,88,12,0.3)",
    overlayType: "dust",
    overlayOpacity: 0.055,
    animationPreset: "playful",
  },
  relax: {
    backgroundTint: "rgba(13,148,136,0.11)",
    bubbleIncoming: "#f0fffe",
    bubbleOutgoing: "#0f766e",
    accentGlow: "rgba(13,148,136,0.28)",
    overlayType: "waves",
    overlayOpacity: 0.05,
    animationPreset: "calm",
  },
  support: {
    backgroundTint: "rgba(124,58,237,0.11)",
    bubbleIncoming: "#faf5ff",
    bubbleOutgoing: "#6d28d9",
    accentGlow: "rgba(124,58,237,0.28)",
    overlayType: "waves",
    overlayOpacity: 0.05,
    animationPreset: "calm",
  },
  gaming: {
    backgroundTint: "rgba(22,163,74,0.11)",
    bubbleIncoming: "#f0fff5",
    bubbleOutgoing: "#15803d",
    accentGlow: "rgba(22,163,74,0.28)",
    overlayType: "grid",
    overlayOpacity: 0.055,
    animationPreset: "playful",
  },
};

/** Токены под тёмную поверхность (MobileChatDark MOODS) */
const pulseDark: Record<VibeThemeCode, VibeThemeTokens> = {
  casual: {
    backgroundTint: "rgba(99,102,241,0.14)",
    bubbleIncoming: "rgba(255,255,255,0.06)",
    bubbleOutgoing: "rgba(79,70,229,0.92)",
    accentGlow: "rgba(99,102,241,0.35)",
    overlayType: "none",
    overlayOpacity: 0,
    animationPreset: "calm",
  },
  romantic: {
    backgroundTint: "rgba(219,39,119,0.12)",
    bubbleIncoming: "rgba(255,240,248,0.09)",
    bubbleOutgoing: "rgba(219,39,119,0.82)",
    accentGlow: "rgba(244,114,182,0.4)",
    overlayType: "hearts",
    overlayOpacity: 0.06,
    animationPreset: "romantic",
  },
  business: {
    backgroundTint: "rgba(37,99,235,0.12)",
    bubbleIncoming: "rgba(230,240,255,0.07)",
    bubbleOutgoing: "rgba(37,99,235,0.85)",
    accentGlow: "rgba(96,165,250,0.35)",
    overlayType: "grid",
    overlayOpacity: 0.05,
    animationPreset: "strict",
  },
  conflict: {
    backgroundTint: "rgba(185,28,28,0.12)",
    bubbleIncoming: "rgba(255,230,230,0.08)",
    bubbleOutgoing: "rgba(185,28,28,0.88)",
    accentGlow: "rgba(248,113,113,0.4)",
    overlayType: "none",
    overlayOpacity: 0,
    animationPreset: "tense",
  },
  fun: {
    backgroundTint: "rgba(234,88,12,0.11)",
    bubbleIncoming: "rgba(255,248,230,0.08)",
    bubbleOutgoing: "rgba(234,88,12,0.86)",
    accentGlow: "rgba(251,146,60,0.4)",
    overlayType: "dust",
    overlayOpacity: 0.055,
    animationPreset: "playful",
  },
  relax: {
    backgroundTint: "rgba(13,148,136,0.11)",
    bubbleIncoming: "rgba(230,255,254,0.07)",
    bubbleOutgoing: "rgba(13,148,136,0.85)",
    accentGlow: "rgba(45,212,191,0.38)",
    overlayType: "waves",
    overlayOpacity: 0.05,
    animationPreset: "calm",
  },
  support: {
    backgroundTint: "rgba(124,58,237,0.11)",
    bubbleIncoming: "rgba(245,235,255,0.08)",
    bubbleOutgoing: "rgba(124,58,237,0.84)",
    accentGlow: "rgba(192,132,252,0.38)",
    overlayType: "waves",
    overlayOpacity: 0.05,
    animationPreset: "calm",
  },
  gaming: {
    backgroundTint: "rgba(21,128,61,0.12)",
    bubbleIncoming: "rgba(230,255,240,0.07)",
    bubbleOutgoing: "rgba(21,128,61,0.88)",
    accentGlow: "rgba(74,222,128,0.4)",
    overlayType: "grid",
    overlayOpacity: 0.055,
    animationPreset: "playful",
  },
};

export type ChatVibeSurface = "light" | "dark";

/** Подпись настроения в шапке (как «Нейтрал» в PULSE) */
export const VIBE_THEME_LABEL_RU: Record<VibeThemeCode, string> = {
  casual: "Нейтрал",
  romantic: "Романтика",
  business: "Деловой",
  conflict: "Конфликт",
  fun: "Веселье",
  relax: "Релакс",
  support: "Поддержка",
  gaming: "Гейминг",
};

export function getClientVibeTokens(
  theme: VibeThemeCode,
  surface: ChatVibeSurface = "dark",
): VibeThemeTokens {
  const table = surface === "light" ? pulseLight : pulseDark;
  return table[theme] ?? table.casual;
}
