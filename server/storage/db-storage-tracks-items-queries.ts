import { eq, and, desc } from "drizzle-orm";
import {
  tracks,
  trackItems,
  callTrackItems,
  callTranscriptSegments,
  callParticipantsHistory,
  callSessionsHistory,
  messages,
} from "@shared/schema";
import { buildTrackListChatNameMap } from "./db-storage-track-chat-name-map";
import {
  mapTrackListCallSegmentItem,
  mapTrackListMessageItem,
  mergeTrackListItemsSorted,
} from "./db-storage-track-list-mappers";
import { dbStorageGetChatMemberIds } from "./db-storage-chat-core-queries";
import { dbStorageGetMessage } from "./db-storage-chat-folders-and-scheduled-queries";
import type { ChatNameResolverDeps } from "./db-storage-message-search-saved-queries";
import { dbStorageGetTrack } from "./db-storage-tracks-core-queries";
import type { AppDb } from "./db-app-db";

export async function dbStorageAddMessageToTrack(
  db: AppDb,
  userId: string,
  trackId: string,
  messageId: string,
  chatId: string,
): Promise<void> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) throw new Error("Трек не найден");
  const memberIds = await dbStorageGetChatMemberIds(db, chatId);
  if (!memberIds.includes(userId)) throw new Error("Нет доступа к чату");
  const msg = await dbStorageGetMessage(db, chatId, messageId);
  if (!msg) throw new Error("Сообщение не найдено");
  await db
    .insert(trackItems)
    .values({ trackId, messageId, chatId })
    .onConflictDoNothing({ target: [trackItems.trackId, trackItems.messageId] });
}

export async function dbStorageAddCallSegmentToTrack(
  db: AppDb,
  userId: string,
  trackId: string,
  segmentId: string,
): Promise<void> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) throw new Error("Трек не найден");
  const [row] = await db
    .select({
      segmentId: callTranscriptSegments.id,
      callId: callTranscriptSegments.callId,
      speakerUserId: callTranscriptSegments.speakerUserId,
      speakerDisplayName: callTranscriptSegments.speakerDisplayName,
      text: callTranscriptSegments.textNormalized,
    })
    .from(callTranscriptSegments)
    .innerJoin(callParticipantsHistory, eq(callParticipantsHistory.callId, callTranscriptSegments.callId))
    .where(and(eq(callTranscriptSegments.id, segmentId), eq(callParticipantsHistory.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Реплика не найдена");
  await db
    .insert(callTrackItems)
    .values({
      trackId,
      callId: row.callId,
      segmentId: row.segmentId,
      speakerUserId: row.speakerUserId,
      speakerDisplayName: row.speakerDisplayName,
      text: row.text,
    })
    .onConflictDoNothing({ target: [callTrackItems.trackId, callTrackItems.segmentId] });
}

export async function dbStorageRemoveTrackItem(
  db: AppDb,
  userId: string,
  trackId: string,
  itemId: string,
): Promise<void> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) throw new Error("Трек не найден");
  const [item] = await db
    .select()
    .from(trackItems)
    .where(and(eq(trackItems.trackId, trackId), eq(trackItems.id, itemId)))
    .limit(1);
  if (item) {
    await db.delete(trackItems).where(eq(trackItems.id, itemId));
    return;
  }
  const [callItem] = await db
    .select()
    .from(callTrackItems)
    .where(and(eq(callTrackItems.trackId, trackId), eq(callTrackItems.id, itemId)))
    .limit(1);
  if (!callItem) throw new Error("Элемент не найден");
  await db.delete(callTrackItems).where(eq(callTrackItems.id, itemId));
}

export async function dbStorageSetTrackItemDone(
  db: AppDb,
  userId: string,
  trackId: string,
  itemId: string,
  done: boolean,
): Promise<void> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) throw new Error("Трек не найден");
  const [item] = await db
    .select()
    .from(trackItems)
    .where(and(eq(trackItems.trackId, trackId), eq(trackItems.id, itemId)))
    .limit(1);
  if (item) {
    await db
      .update(trackItems)
      .set({ doneAt: done ? new Date() : null })
      .where(eq(trackItems.id, itemId));
    return;
  }
  const [callItem] = await db
    .select()
    .from(callTrackItems)
    .where(and(eq(callTrackItems.trackId, trackId), eq(callTrackItems.id, itemId)))
    .limit(1);
  if (!callItem) throw new Error("Элемент не найден");
  await db
    .update(callTrackItems)
    .set({ doneAt: done ? new Date() : null })
    .where(eq(callTrackItems.id, itemId));
}

export async function dbStorageListTrackItems(
  db: AppDb,
  userId: string,
  trackId: string,
  deps: ChatNameResolverDeps,
): Promise<
  {
    id: string;
    sourceType: "message" | "call_segment";
    messageId: string | null;
    chatId: string | null;
    callId: string | null;
    chatName: string;
    speakerDisplayName: string | null;
    content: string;
    type: string;
    messageCreatedAt: Date;
    addedAt: Date;
    doneAt: Date | null;
  }[]
> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) return [];
  const rows = await db
    .select({
      id: trackItems.id,
      messageId: trackItems.messageId,
      chatId: trackItems.chatId,
      content: messages.content,
      type: messages.type,
      messageCreatedAt: messages.createdAt,
      addedAt: trackItems.addedAt,
      doneAt: trackItems.doneAt,
    })
    .from(trackItems)
    .innerJoin(messages, eq(messages.id, trackItems.messageId))
    .where(eq(trackItems.trackId, trackId))
    .orderBy(desc(trackItems.addedAt));
  const callRows = await db
    .select({
      id: callTrackItems.id,
      callId: callTrackItems.callId,
      speakerDisplayName: callTrackItems.speakerDisplayName,
      content: callTrackItems.text,
      createdAt: callTranscriptSegments.createdAt,
      addedAt: callTrackItems.addedAt,
      doneAt: callTrackItems.doneAt,
      chatId: callSessionsHistory.chatId,
    })
    .from(callTrackItems)
    .innerJoin(callTranscriptSegments, eq(callTranscriptSegments.id, callTrackItems.segmentId))
    .innerJoin(callSessionsHistory, eq(callSessionsHistory.id, callTrackItems.callId))
    .where(eq(callTrackItems.trackId, trackId))
    .orderBy(desc(callTrackItems.addedAt));
  const chatNames = await buildTrackListChatNameMap(userId, rows, callRows, deps);
  const messageItems = rows.map((r) => mapTrackListMessageItem(r, chatNames.get(r.chatId) || "Чат"));
  const segmentItems = callRows.map((r) => mapTrackListCallSegmentItem(r, chatNames.get(r.chatId) || "Чат"));
  return mergeTrackListItemsSorted(messageItems, segmentItems);
}
