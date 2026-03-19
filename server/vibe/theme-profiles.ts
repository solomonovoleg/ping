import type { VibeThemeCode, VibeThemeTokens } from "@shared/chat-vibe-types";

const profiles: Record<VibeThemeCode, VibeThemeTokens> = {
  /** Нейтральный «базовый» вайб: лёгкий оттенок, чтобы режим был заметен до смены темы движком */
  casual: {
    backgroundTint: "rgba(79, 70, 229, 0.08)",
    bubbleIncoming: "rgba(79, 70, 229, 0.05)",
    bubbleOutgoing: "rgba(79, 70, 229, 0.06)",
    accentGlow: "rgba(129, 140, 248, 0.12)",
    overlayType: "none",
    overlayOpacity: 0,
    animationPreset: "calm",
  },
  romantic: {
    backgroundTint: "rgba(75, 31, 50, 0.12)",
    bubbleIncoming: "rgba(93, 43, 67, 0.08)",
    bubbleOutgoing: "rgba(93, 43, 67, 0.12)",
    accentGlow: "rgba(219, 112, 147, 0.15)",
    overlayType: "hearts",
    overlayOpacity: 0.05,
    animationPreset: "romantic",
  },
  business: {
    backgroundTint: "rgba(30, 41, 59, 0.10)",
    bubbleIncoming: "rgba(51, 65, 85, 0.06)",
    bubbleOutgoing: "rgba(51, 65, 85, 0.10)",
    accentGlow: "rgba(100, 116, 139, 0.12)",
    overlayType: "grid",
    overlayOpacity: 0.04,
    animationPreset: "strict",
  },
  conflict: {
    backgroundTint: "rgba(127, 29, 29, 0.10)",
    bubbleIncoming: "rgba(153, 27, 27, 0.06)",
    bubbleOutgoing: "rgba(153, 27, 27, 0.08)",
    accentGlow: "rgba(220, 38, 38, 0.10)",
    overlayType: "none",
    overlayOpacity: 0,
    animationPreset: "tense",
  },
  fun: {
    backgroundTint: "rgba(251, 191, 36, 0.08)",
    bubbleIncoming: "rgba(234, 179, 8, 0.05)",
    bubbleOutgoing: "rgba(234, 179, 8, 0.10)",
    accentGlow: "rgba(253, 224, 71, 0.12)",
    overlayType: "dust",
    overlayOpacity: 0.04,
    animationPreset: "playful",
  },
  relax: {
    backgroundTint: "rgba(120, 53, 15, 0.08)",
    bubbleIncoming: "rgba(146, 64, 14, 0.05)",
    bubbleOutgoing: "rgba(146, 64, 14, 0.08)",
    accentGlow: "rgba(180, 83, 9, 0.10)",
    overlayType: "waves",
    overlayOpacity: 0.04,
    animationPreset: "calm",
  },
  support: {
    backgroundTint: "rgba(49, 46, 129, 0.08)",
    bubbleIncoming: "rgba(67, 56, 202, 0.05)",
    bubbleOutgoing: "rgba(67, 56, 202, 0.08)",
    accentGlow: "rgba(99, 102, 241, 0.12)",
    overlayType: "waves",
    overlayOpacity: 0.04,
    animationPreset: "calm",
  },
  gaming: {
    backgroundTint: "rgba(6, 78, 59, 0.10)",
    bubbleIncoming: "rgba(5, 150, 105, 0.06)",
    bubbleOutgoing: "rgba(5, 150, 105, 0.10)",
    accentGlow: "rgba(16, 185, 129, 0.15)",
    overlayType: "grid",
    overlayOpacity: 0.05,
    animationPreset: "playful",
  },
};

export function getVibeThemeTokens(theme: VibeThemeCode): VibeThemeTokens {
  return profiles[theme] ?? profiles.casual;
}
