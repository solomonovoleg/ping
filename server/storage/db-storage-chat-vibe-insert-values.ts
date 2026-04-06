import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";

export function buildChatVibeBatchInsertValues(data: {
  chatId: string;
  windowSize: number;
  dominantPattern: VibeThemeCode;
  secondaryPattern?: VibeThemeCode;
  confidence: number;
  axes: VibeAxes;
  toxicityFlag?: boolean;
}) {
  return {
    chatId: data.chatId,
    windowSize: data.windowSize,
    dominantPattern: data.dominantPattern,
    secondaryPattern: data.secondaryPattern ?? null,
    confidence: String(data.confidence),
    warmth: data.axes.warmth,
    tension: data.axes.tension,
    playfulness: data.axes.playfulness,
    intimacy: data.axes.intimacy,
    formality: data.axes.formality,
    energy: data.axes.energy,
    toxicityFlag: data.toxicityFlag ?? false,
  };
}

export function buildChatVibeHistoryInsertValues(data: {
  chatId: string;
  oldTheme: string;
  newTheme: string;
  oldConfidence: number;
  newConfidence: number;
  triggerType: string;
}) {
  return {
    chatId: data.chatId,
    oldTheme: data.oldTheme,
    newTheme: data.newTheme,
    oldConfidence: String(data.oldConfidence),
    newConfidence: String(data.newConfidence),
    triggerType: data.triggerType,
  };
}
