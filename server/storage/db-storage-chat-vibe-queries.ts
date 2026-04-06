import { eq, desc } from "drizzle-orm";
import type { ChatVibeState, ChatVibeBatch, ChatVibeHistoryEntry } from "@shared/schema";
import { chatVibeState, chatVibeBatches, chatVibeHistory } from "@shared/schema";
import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";
import { buildChatVibeBatchInsertValues, buildChatVibeHistoryInsertValues } from "./db-storage-chat-vibe-insert-values";
import { buildChatVibeStateUpsertPayload } from "./db-storage-chat-vibe-state-upsert-payload";
import type { AppDb } from "./db-app-db";

export async function dbStorageGetVibeState(db: AppDb, chatId: string): Promise<ChatVibeState | undefined> {
  const [row] = await db
    .select()
    .from(chatVibeState)
    .where(eq(chatVibeState.chatId, chatId))
    .limit(1);
  return row;
}

export async function dbStorageUpsertVibeState(
  db: AppDb,
  chatId: string,
  data: {
    theme: VibeThemeCode;
    confidence: number;
    axes: VibeAxes;
    messageCounter: number;
    themeVersion?: number;
    touchLastBatchAt?: boolean;
  },
): Promise<ChatVibeState> {
  const now = new Date();
  const { insertValues, updateSet } = buildChatVibeStateUpsertPayload(chatId, data, now);
  const [row] = await db
    .insert(chatVibeState)
    .values(insertValues)
    .onConflictDoUpdate({
      target: chatVibeState.chatId,
      set: updateSet as typeof insertValues,
    })
    .returning();
  return row;
}

export async function dbStorageCreateVibeBatch(
  db: AppDb,
  data: {
    chatId: string;
    windowSize: number;
    dominantPattern: VibeThemeCode;
    secondaryPattern?: VibeThemeCode;
    confidence: number;
    axes: VibeAxes;
    toxicityFlag?: boolean;
  },
): Promise<ChatVibeBatch> {
  const [row] = await db
    .insert(chatVibeBatches)
    .values(buildChatVibeBatchInsertValues(data))
    .returning();
  return row;
}

export async function dbStorageGetRecentVibeBatches(
  db: AppDb,
  chatId: string,
  limit: number,
): Promise<ChatVibeBatch[]> {
  return db
    .select()
    .from(chatVibeBatches)
    .where(eq(chatVibeBatches.chatId, chatId))
    .orderBy(desc(chatVibeBatches.createdAt))
    .limit(limit);
}

export async function dbStorageCreateVibeHistoryEntry(
  db: AppDb,
  data: {
    chatId: string;
    oldTheme: string;
    newTheme: string;
    oldConfidence: number;
    newConfidence: number;
    triggerType: string;
  },
): Promise<ChatVibeHistoryEntry> {
  const [row] = await db
    .insert(chatVibeHistory)
    .values(buildChatVibeHistoryInsertValues(data))
    .returning();
  return row;
}
