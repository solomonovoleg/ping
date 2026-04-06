import { eq, and, desc, asc, lte, inArray } from "drizzle-orm";
import type { ChatFolder, Message, InsertMessage } from "@shared/schema";
import { chatFolders, messages, messageHidden, scheduledMessages } from "@shared/schema";
import {
  buildMainChatFolderInsertValues,
  decideChatFolderRename,
  trimChatFolderCreateName,
} from "./db-storage-chat-folder-helpers";
import {
  normalizeMessageTranscriptForStorage,
  normalizeOutgoingMessageContent,
} from "./db-storage-message-content-normalize";
import { pluckHiddenMessageIds } from "./db-storage-message-hidden-pluck";
import { firstInsertReturningRow } from "./db-storage-insert-returning-row";
import { buildScheduledMessageInsertValues } from "./db-storage-scheduled-message-insert-values";
import { clampScheduledMessagesDueLimit } from "./db-storage-scheduled-messages-due-batch";
import {
  scheduledMessagesDueRowSelect,
  SCHEDULED_MESSAGES_DUE_ORDER,
} from "./db-storage-scheduled-messages-due-select";
import type { AppDb } from "./db-app-db";

export async function dbStorageListChatFolders(db: AppDb, chatId: string): Promise<ChatFolder[]> {
  const rows = await db
    .select()
    .from(chatFolders)
    .where(eq(chatFolders.chatId, chatId))
    .orderBy(asc(chatFolders.orderIndex), asc(chatFolders.createdAt));
  return rows;
}

export async function dbStorageGetOrCreateMainFolder(db: AppDb, chatId: string): Promise<ChatFolder> {
  const [existing] = await db
    .select()
    .from(chatFolders)
    .where(and(eq(chatFolders.chatId, chatId), eq(chatFolders.isMain, true)))
    .limit(1);
  if (existing) return existing;
  const [row] = await db.insert(chatFolders).values(buildMainChatFolderInsertValues(chatId)).returning();
  if (!row) throw new Error("Create main folder failed");
  return row;
}

export async function dbStorageCreateChatFolder(
  db: AppDb,
  chatId: string,
  name: string,
  orderIndex: number,
): Promise<ChatFolder> {
  const [row] = await db
    .insert(chatFolders)
    .values({ chatId, name: trimChatFolderCreateName(name), isMain: false, orderIndex })
    .returning();
  if (!row) throw new Error("Create folder failed");
  return row;
}

export async function dbStorageGetChatFolder(db: AppDb, folderId: string): Promise<ChatFolder | undefined> {
  const [row] = await db.select().from(chatFolders).where(eq(chatFolders.id, folderId)).limit(1);
  return row;
}

export async function dbStorageUpdateChatFolder(
  db: AppDb,
  folderId: string,
  data: { name?: string },
  getFolder: (id: string) => Promise<ChatFolder | undefined>,
): Promise<ChatFolder | undefined> {
  const decision = decideChatFolderRename(data);
  if (!decision.apply) return getFolder(folderId);
  const [row] = await db
    .update(chatFolders)
    .set({ name: decision.name })
    .where(eq(chatFolders.id, folderId))
    .returning();
  return row;
}

export async function dbStorageDeleteChatFolder(db: AppDb, folderId: string): Promise<boolean> {
  const [folder] = await db.select().from(chatFolders).where(eq(chatFolders.id, folderId)).limit(1);
  if (!folder || folder.isMain) return false;
  const r = await db.delete(chatFolders).where(eq(chatFolders.id, folderId));
  return (r.rowCount ?? 0) > 0;
}

export async function dbStorageGetLastMessage(db: AppDb, chatId: string): Promise<Message | undefined> {
  const [row] = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row as Message | undefined;
}

export async function dbStorageCreateMessage(db: AppDb, data: InsertMessage): Promise<Message> {
  const result = await db.insert(messages).values(data).returning();
  const rows = Array.isArray(result) ? result : [];
  const [row] = rows;
  if (!row) throw new Error("Insert message failed");
  return row as Message;
}

export async function dbStorageGetMessage(
  db: AppDb,
  chatId: string,
  messageId: string,
): Promise<Message | undefined> {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
    .limit(1);
  return row as Message | undefined;
}

/** Одним запросом: сообщения чата с указанными id (для reply-preview без N+1). */
export async function dbStorageGetMessagesByIdsInChat(
  db: AppDb,
  chatId: string,
  messageIds: string[],
): Promise<Map<string, Message>> {
  const out = new Map<string, Message>();
  const unique = [...new Set(messageIds.filter(Boolean))];
  if (unique.length === 0) return out;
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.chatId, chatId), inArray(messages.id, unique)));
  for (const row of rows) {
    out.set(row.id, row as Message);
  }
  return out;
}

export async function dbStorageGetMessageById(db: AppDb, messageId: string): Promise<Message | undefined> {
  const [row] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
  return row as Message | undefined;
}

export async function dbStorageDeleteMessage(db: AppDb, chatId: string, messageId: string): Promise<boolean> {
  const r = await db
    .delete(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)));
  return (r.rowCount ?? 0) > 0;
}

export async function dbStorageUpdateMessage(
  db: AppDb,
  chatId: string,
  messageId: string,
  content: string,
): Promise<Message | undefined> {
  const [row] = await db
    .update(messages)
    .set({ content: normalizeOutgoingMessageContent(content) })
    .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
    .returning();
  return row as Message | undefined;
}

export async function dbStorageUpdateMessageTranscript(
  db: AppDb,
  chatId: string,
  messageId: string,
  transcript: string,
): Promise<Message | undefined> {
  const [row] = await db
    .update(messages)
    .set({ transcript: normalizeMessageTranscriptForStorage(transcript) })
    .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
    .returning();
  return row as Message | undefined;
}

export async function dbStorageAddMessageHidden(
  db: AppDb,
  userId: string,
  chatId: string,
  messageId: string,
): Promise<void> {
  await db
    .insert(messageHidden)
    .values({ userId, chatId, messageId })
    .onConflictDoNothing({ target: [messageHidden.userId, messageHidden.chatId, messageHidden.messageId] });
}

export async function dbStorageGetHiddenMessageIdsForUserInChat(
  db: AppDb,
  userId: string,
  chatId: string,
): Promise<string[]> {
  const rows = await db
    .select({ messageId: messageHidden.messageId })
    .from(messageHidden)
    .where(and(eq(messageHidden.userId, userId), eq(messageHidden.chatId, chatId)));
  return pluckHiddenMessageIds(rows);
}

export async function dbStorageCreateScheduledMessage(
  db: AppDb,
  data: {
    chatId: string;
    folderId?: string | null;
    senderId: string;
    type: string;
    content: string;
    replyToId?: string | null;
    scheduledAt: Date;
  },
): Promise<{ id: string; scheduledAt: Date }> {
  const result = await db
    .insert(scheduledMessages)
    .values(buildScheduledMessageInsertValues(data))
    .returning({ id: scheduledMessages.id, scheduledAt: scheduledMessages.scheduledAt });
  return firstInsertReturningRow(result, "Insert scheduled message failed") as {
    id: string;
    scheduledAt: Date;
  };
}

export async function dbStorageGetScheduledMessagesDue(
  db: AppDb,
  limit: number,
): Promise<
  {
    id: string;
    chatId: string;
    folderId: string | null;
    senderId: string | null;
    type: string;
    content: string;
    replyToId: string | null;
  }[]
> {
  const now = new Date();
  const rows = await db
    .select(scheduledMessagesDueRowSelect)
    .from(scheduledMessages)
    .where(lte(scheduledMessages.scheduledAt, now))
    .orderBy(...SCHEDULED_MESSAGES_DUE_ORDER)
    .limit(clampScheduledMessagesDueLimit(limit));
  return rows as {
    id: string;
    chatId: string;
    folderId: string | null;
    senderId: string | null;
    type: string;
    content: string;
    replyToId: string | null;
  }[];
}

export async function dbStorageDeleteScheduledMessage(db: AppDb, id: string): Promise<boolean> {
  const r = await db.delete(scheduledMessages).where(eq(scheduledMessages.id, id));
  return (r.rowCount ?? 0) > 0;
}
