import type { VibeThemeCode, VibeThemeTokens } from "@shared/chat-vibe-types";

/**
 * Токены для API / realtime. Цвета пузырей синхронизированы с `client/src/lib/chat-vibe-themes.ts` (pulseDark):
 * входящий — светлый полупрозрачный, исходящий — насыщенный акцент. Раньше in/out отличались на ~0.01 альфы —
 * в UI после merge выглядели как один цвет.
 */
const profiles: Record<VibeThemeCode, VibeThemeTokens> = {
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

export function getVibeThemeTokens(theme: VibeThemeCode): VibeThemeTokens {
  return profiles[theme] ?? profiles.casual;
}
