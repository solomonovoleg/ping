import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";
import { chatVibeState } from "@shared/schema";

type ChatVibeStateInsert = typeof chatVibeState.$inferInsert;

export type UpsertVibeStateInput = {
  theme: VibeThemeCode;
  confidence: number;
  axes: VibeAxes;
  messageCounter: number;
  themeVersion?: number;
  touchLastBatchAt?: boolean;
};

/** Значения вставки и `set` для `onConflictDoUpdate` по `chat_vibe_state.chat_id`. */
export function buildChatVibeStateUpsertPayload(
  chatId: string,
  data: UpsertVibeStateInput,
  now: Date,
): {
  insertValues: ChatVibeStateInsert;
  updateSet: Record<string, unknown>;
} {
  const touchBatch = data.touchLastBatchAt === true;
  const insertValues: ChatVibeStateInsert = {
    chatId,
    theme: data.theme,
    confidence: String(data.confidence),
    warmth: data.axes.warmth,
    tension: data.axes.tension,
    playfulness: data.axes.playfulness,
    intimacy: data.axes.intimacy,
    formality: data.axes.formality,
    energy: data.axes.energy,
    messageCounter: data.messageCounter,
    lastBatchAt: touchBatch ? now : null,
    updatedAt: now,
    ...(data.themeVersion !== undefined ? { themeVersion: data.themeVersion } : {}),
  };

  const updateSet: Record<string, unknown> = {
    theme: data.theme,
    confidence: String(data.confidence),
    warmth: data.axes.warmth,
    tension: data.axes.tension,
    playfulness: data.axes.playfulness,
    intimacy: data.axes.intimacy,
    formality: data.axes.formality,
    energy: data.axes.energy,
    messageCounter: data.messageCounter,
    updatedAt: now,
  };
  if (data.themeVersion !== undefined) updateSet.themeVersion = data.themeVersion;
  if (touchBatch) updateSet.lastBatchAt = now;

  return { insertValues, updateSet };
}
