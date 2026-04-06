import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import {
  callSessionsHistory,
  callParticipantsHistory,
  callTranscriptSegments,
  callCommandSuggestions,
} from "@shared/schema";
import { callParticipantCountsToMap } from "./db-storage-call-participant-count-map";
import { findFirstCallParticipantId } from "./db-storage-call-participant-lookup";
import { buildCallSessionListChatNameMap } from "./db-storage-call-session-chat-name-map";
import { mergeCallSessionsHistoryRowsWithMeta } from "./db-storage-call-sessions-history-assemble";
import {
  buildCallTranscriptSegmentConflictUpdate,
  buildCallTranscriptSegmentInsertValues,
  type CallTranscriptSegmentUpsertInput,
} from "./db-storage-call-transcript-segment-payload";
import type { CallTranscriptSegment } from "@shared/schema";
import type { Chat } from "@shared/schema";
import type { AppDb } from "./db-app-db";

export async function dbStorageCreateCallSessionHistory(
  db: AppDb,
  data: {
    id: string;
    chatId: string;
    mediaType: "audio" | "video";
    createdByUserId: string;
  },
) {
  const [row] = await db
    .insert(callSessionsHistory)
    .values(data)
    .onConflictDoNothing({ target: [callSessionsHistory.id] })
    .returning();
  return row ?? (await db.select().from(callSessionsHistory).where(eq(callSessionsHistory.id, data.id)).limit(1))[0]!;
}

export async function dbStorageEndCallSessionHistory(db: AppDb, callId: string): Promise<void> {
  await db
    .update(callSessionsHistory)
    .set({ endedAt: new Date() })
    .where(and(eq(callSessionsHistory.id, callId), isNull(callSessionsHistory.endedAt)));
}

export async function dbStorageUpsertCallParticipantHistory(
  db: AppDb,
  callId: string,
  userId: string,
  displayNameSnapshot: string,
) {
  const [row] = await db
    .insert(callParticipantsHistory)
    .values({ callId, userId, displayNameSnapshot, leftAt: null })
    .onConflictDoUpdate({
      target: [callParticipantsHistory.callId, callParticipantsHistory.userId],
      set: { displayNameSnapshot, leftAt: null },
    })
    .returning();
  return row;
}

export async function dbStorageMarkCallParticipantLeft(
  db: AppDb,
  callId: string,
  userId: string,
): Promise<void> {
  await db
    .update(callParticipantsHistory)
    .set({ leftAt: new Date() })
    .where(and(eq(callParticipantsHistory.callId, callId), eq(callParticipantsHistory.userId, userId)));
}

export async function dbStorageUpsertCallTranscriptSegment(
  db: AppDb,
  data: CallTranscriptSegmentUpsertInput,
): Promise<CallTranscriptSegment> {
  const updatedAt = new Date();
  const [row] = await db
    .insert(callTranscriptSegments)
    .values(buildCallTranscriptSegmentInsertValues(data, updatedAt))
    .onConflictDoUpdate({
      target: [callTranscriptSegments.id],
      set: buildCallTranscriptSegmentConflictUpdate(data, updatedAt),
    })
    .returning();
  return row;
}

export async function dbStorageGetCallTranscriptSegment(
  db: AppDb,
  callId: string,
  segmentId: string,
): Promise<CallTranscriptSegment | undefined> {
  const [row] = await db
    .select()
    .from(callTranscriptSegments)
    .where(and(eq(callTranscriptSegments.callId, callId), eq(callTranscriptSegments.id, segmentId)))
    .limit(1);
  return row;
}

export async function dbStorageListCallTranscriptSegments(
  db: AppDb,
  userId: string,
  callId: string,
): Promise<CallTranscriptSegment[]> {
  const participantId = await findFirstCallParticipantId(db, callId, userId);
  if (participantId === undefined) return [];
  return db
    .select()
    .from(callTranscriptSegments)
    .where(eq(callTranscriptSegments.callId, callId))
    .orderBy(asc(callTranscriptSegments.createdAt));
}

export async function dbStorageListCallSessionsHistory(
  db: AppDb,
  userId: string,
  getChatById: (id: string) => Promise<Chat | undefined>,
): Promise<Array<typeof callSessionsHistory.$inferSelect & { participantCount: number; chatName: string }>> {
  const rows = await db
    .select({
      id: callSessionsHistory.id,
      chatId: callSessionsHistory.chatId,
      mediaType: callSessionsHistory.mediaType,
      createdByUserId: callSessionsHistory.createdByUserId,
      createdAt: callSessionsHistory.createdAt,
      endedAt: callSessionsHistory.endedAt,
    })
    .from(callSessionsHistory)
    .innerJoin(callParticipantsHistory, eq(callParticipantsHistory.callId, callSessionsHistory.id))
    .where(eq(callParticipantsHistory.userId, userId))
    .orderBy(desc(callSessionsHistory.createdAt));
  const participantCounts = await db
    .select({
      callId: callParticipantsHistory.callId,
      count: sql<number>`count(*)::int`,
    })
    .from(callParticipantsHistory)
    .groupBy(callParticipantsHistory.callId);
  const countMap = callParticipantCountsToMap(participantCounts);
  const chatMap = await buildCallSessionListChatNameMap(rows, getChatById);
  return mergeCallSessionsHistoryRowsWithMeta(rows, countMap, chatMap);
}

export async function dbStorageCreateCallCommandSuggestion(
  db: AppDb,
  data: {
    callId: string;
    segmentId?: string | null;
    intentType: string;
    title: string;
    payloadJson: string;
  },
) {
  const [row] = await db
    .insert(callCommandSuggestions)
    .values(data)
    .onConflictDoNothing({ target: [callCommandSuggestions.segmentId, callCommandSuggestions.intentType] })
    .returning();
  return row ?? (await db
    .select()
    .from(callCommandSuggestions)
    .where(
      and(
        eq(callCommandSuggestions.segmentId, data.segmentId ?? ""),
        eq(callCommandSuggestions.intentType, data.intentType),
      ),
    )
    .limit(1))[0]!;
}

export async function dbStorageListCallCommandSuggestions(db: AppDb, userId: string, callId: string) {
  const participantId = await findFirstCallParticipantId(db, callId, userId);
  if (participantId === undefined) return [];
  return db
    .select()
    .from(callCommandSuggestions)
    .where(eq(callCommandSuggestions.callId, callId))
    .orderBy(desc(callCommandSuggestions.createdAt));
}

export async function dbStorageResolveCallCommandSuggestion(
  db: AppDb,
  userId: string,
  callId: string,
  suggestionId: string,
  status: "accepted" | "dismissed",
): Promise<void> {
  await db
    .update(callCommandSuggestions)
    .set({ status, resolvedAt: new Date(), resolvedByUserId: userId })
    .where(and(eq(callCommandSuggestions.id, suggestionId), eq(callCommandSuggestions.callId, callId)));
}
