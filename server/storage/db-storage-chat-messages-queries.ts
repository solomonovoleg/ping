import { eq, and, desc, sql, gt, inArray } from "drizzle-orm";
import type { Message } from "@shared/schema";
import { chatMembers, messages } from "@shared/schema";
import { unreadExcludesOwnMessagesCondition, unreadNonSystemMessageTypeCondition } from "./db-storage-unread-message-conditions";
import { messageFolderIdCondition } from "./db-storage-message-folder-conditions";
import {
  monotonicLastReadTimestamp,
  selectChatMemberLastReadAt,
} from "./db-storage-chat-member-read";
import { CHAT_MEDIA_MESSAGE_TYPES } from "./db-storage-chat-media-message-types";
import { messagesCreatedBefore, selectMessageCreatedAtForPageCursor } from "./db-storage-message-cursor";
import type { AppDb } from "./db-app-db";

export async function dbStorageUpdateLastRead(
  db: AppDb,
  chatId: string,
  userId: string,
  readUpTo?: Date,
): Promise<void> {
  if (!readUpTo) return;
  const current = await selectChatMemberLastReadAt(db, chatId, userId);
  const at = monotonicLastReadTimestamp(current, readUpTo);
  await db
    .update(chatMembers)
    .set({ lastReadAt: at })
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
}

export async function dbStorageUpdateLastReadByMessageId(
  db: AppDb,
  chatId: string,
  userId: string,
  messageId: string,
): Promise<void> {
  await db.execute(sql`
      UPDATE chat_members
      SET last_read_at = GREATEST(
        COALESCE(last_read_at, '1970-01-01'::timestamptz),
        COALESCE(
          (SELECT created_at FROM messages WHERE id = ${messageId} AND chat_id = ${chatId}),
          last_read_at
        )
      )
      WHERE chat_id = ${chatId} AND user_id = ${userId}
    `);
}

export async function dbStorageGetChatMemberLastReadAt(
  db: AppDb,
  chatId: string,
  userId: string,
): Promise<Date | null> {
  return selectChatMemberLastReadAt(db, chatId, userId);
}

export async function dbStorageGetUnreadCount(db: AppDb, chatId: string, userId: string): Promise<number> {
  const since = await selectChatMemberLastReadAt(db, chatId, userId);
  const fromOthers = unreadExcludesOwnMessagesCondition(userId);
  const unreadEligible = unreadNonSystemMessageTypeCondition();
  if (!since) {
    const [r] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), fromOthers, unreadEligible));
    return r?.count ?? 0;
  }
  const [r] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.chatId, chatId), gt(messages.createdAt, since), fromOthers, unreadEligible));
  return r?.count ?? 0;
}

export async function dbStorageGetUnreadCountByFolder(
  db: AppDb,
  chatId: string,
  folderId: string | null,
  userId: string,
): Promise<number> {
  const since = await selectChatMemberLastReadAt(db, chatId, userId);
  const fromOthers = unreadExcludesOwnMessagesCondition(userId);
  const unreadEligible = unreadNonSystemMessageTypeCondition();
  const folderCond = messageFolderIdCondition(folderId);
  if (!since) {
    const [r] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), folderCond, fromOthers, unreadEligible));
    return r?.count ?? 0;
  }
  const [r] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        folderCond,
        gt(messages.createdAt, since),
        fromOthers,
        unreadEligible,
      ),
    );
  return r?.count ?? 0;
}

export async function dbStorageGetMessageCountByFolder(
  db: AppDb,
  chatId: string,
  folderId: string,
): Promise<number> {
  const [r] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.folderId, folderId)));
  return r?.count ?? 0;
}

export async function dbStorageGetMessagesByChatId(
  db: AppDb,
  chatId: string,
  limit = 100,
  beforeMessageId?: string,
  folderId?: string | null,
): Promise<Message[]> {
  const conditions = [eq(messages.chatId, chatId), messageFolderIdCondition(folderId)];
  if (beforeMessageId) {
    const beforeAt = await selectMessageCreatedAtForPageCursor(db, chatId, beforeMessageId);
    if (beforeAt !== undefined) conditions.push(messagesCreatedBefore(beforeAt));
  }
  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(Math.min(limit, 200));
  return rows.reverse() as Message[];
}

export async function dbStorageGetMediaMessages(
  db: AppDb,
  chatId: string,
  folderId: string | null,
  limit: number,
  beforeMessageId?: string,
): Promise<Message[]> {
  const conditions = [
    eq(messages.chatId, chatId),
    inArray(messages.type, [...CHAT_MEDIA_MESSAGE_TYPES]),
    messageFolderIdCondition(folderId),
  ];
  if (beforeMessageId) {
    const beforeAt = await selectMessageCreatedAtForPageCursor(db, chatId, beforeMessageId);
    if (beforeAt !== undefined) conditions.push(messagesCreatedBefore(beforeAt));
  }
  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(Math.min(limit, 100));
  return rows.reverse() as Message[];
}

export async function dbStorageGetTextMessagesForLinks(
  db: AppDb,
  chatId: string,
  folderId: string | null,
  limit: number,
  beforeMessageId?: string,
): Promise<Pick<Message, "id" | "content" | "createdAt">[]> {
  const conditions = [eq(messages.chatId, chatId), eq(messages.type, "text"), messageFolderIdCondition(folderId)];
  if (beforeMessageId) {
    const beforeAt = await selectMessageCreatedAtForPageCursor(db, chatId, beforeMessageId);
    if (beforeAt !== undefined) conditions.push(messagesCreatedBefore(beforeAt));
  }
  const rows = await db
    .select({ id: messages.id, content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(Math.min(limit, 200));
  return rows.reverse() as Pick<Message, "id" | "content" | "createdAt">[];
}
