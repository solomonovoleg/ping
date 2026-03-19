export const VIBE_THEMES = [
  "casual",
  "romantic",
  "business",
  "conflict",
  "fun",
  "relax",
  "support",
  "gaming",
] as const;

export type VibeThemeCode = (typeof VIBE_THEMES)[number];

export type VibeAxes = {
  warmth: number;
  tension: number;
  playfulness: number;
  intimacy: number;
  formality: number;
  energy: number;
};

export type VibeBatchResult = {
  dominantPattern: VibeThemeCode;
  secondaryPattern?: VibeThemeCode;
  confidence: number;
  axes: VibeAxes;
  reasonCodes: string[];
  visualIntensity: 0 | 1 | 2;
};

export type VibeThemeTokens = {
  backgroundTint: string;
  bubbleIncoming: string;
  bubbleOutgoing: string;
  accentGlow: string;
  overlayType: "none" | "hearts" | "grid" | "dust" | "waves";
  overlayOpacity: number;
  animationPreset: "calm" | "playful" | "romantic" | "strict" | "tense";
};

export type VibeState = {
  chatId: string;
  theme: VibeThemeCode;
  confidence: number;
  axes: VibeAxes;
  messageCounter: number;
  themeVersion: number;
  lastBatchAt: Date | null;
  updatedAt: Date;
};

export type VibeUpdatePayload = {
  type: "chat-vibe-update";
  chatId: string;
  theme: VibeThemeCode;
  confidence: number;
  tokens: VibeThemeTokens;
  visualIntensity: 0 | 1 | 2;
};

export type VibeUserSettings = {
  vibeEnabled: boolean;
  vibeShareWithPartner: boolean;
};
