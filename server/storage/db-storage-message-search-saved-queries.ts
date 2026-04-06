import { eq, and, desc, ilike } from "drizzle-orm";
import type { Chat, User } from "@shared/schema";
import { chatMembers, messages, savedMessages } from "@shared/schema";
import { buildChatNameMapForMessageRows } from "./db-storage-message-chat-name-map";
import {
  buildMessageContentSearchIlikePattern,
  clampSearchMessagesLimit,
} from "./db-storage-search-messages-query-helpers";
import { mapSearchMessageRowsToResults } from "./db-storage-search-message-result-map";
import { mapSavedMessageRowsToListResults } from "./db-storage-saved-message-result-map";
import type { AppDb } from "./db-app-db";

export type ChatNameResolverDeps = {
  getChatById: (id: string) => Promise<Chat | undefined>;
  getChatMemberIds: (id: string) => Promise<string[]>;
  getUser: (id: string) => Promise<User | undefined>;
};

export async function dbStorageSearchMessages(
  db: AppDb,
  userId: string,
  query: string,
  limit: number,
  deps: ChatNameResolverDeps,
): Promise<{ messageId: string; chatId: string; type: string; content: string; createdAt: Date; chatName: string }[]> {
  const q = query.trim();
  if (!q) return [];
  const like = buildMessageContentSearchIlikePattern(q);
  const rows = await db
    .select({
      id: messages.id,
      chatId: messages.chatId,
      type: messages.type,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(chatMembers, eq(chatMembers.chatId, messages.chatId))
    .where(and(eq(chatMembers.userId, userId), ilike(messages.content, like)))
    .orderBy(desc(messages.createdAt))
    .limit(clampSearchMessagesLimit(limit));
  const chatNames = await buildChatNameMapForMessageRows(userId, rows, deps);
  return mapSearchMessageRowsToResults(rows, chatNames);
}

export async function dbStorageSaveMessage(
  db: AppDb,
  userId: string,
  messageId: string,
  chatId: string,
): Promise<void> {
  await db
    .insert(savedMessages)
    .values({ userId, messageId, chatId })
    .onConflictDoNothing();
}

export async function dbStorageUnsaveMessage(db: AppDb, userId: string, messageId: string): Promise<void> {
  await db
    .delete(savedMessages)
    .where(and(eq(savedMessages.userId, userId), eq(savedMessages.messageId, messageId)));
}

export async function dbStorageListSavedMessages(
  db: AppDb,
  userId: string,
  limit: number,
  offset: number,
  deps: ChatNameResolverDeps,
): Promise<
  {
    messageId: string;
    chatId: string;
    savedAt: Date;
    content: string;
    type: string;
    chatName: string;
  }[]
> {
  const rows = await db
    .select({
      messageId: savedMessages.messageId,
      chatId: savedMessages.chatId,
      savedAt: savedMessages.savedAt,
      content: messages.content,
      type: messages.type,
    })
    .from(savedMessages)
    .innerJoin(messages, eq(messages.id, savedMessages.messageId))
    .where(eq(savedMessages.userId, userId))
    .orderBy(desc(savedMessages.savedAt))
    .limit(limit)
    .offset(offset);
  const chatNames = await buildChatNameMapForMessageRows(userId, rows, deps);
  return mapSavedMessageRowsToListResults(rows, chatNames);
}

export async function dbStorageIsMessageSaved(
  db: AppDb,
  userId: string,
  messageId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ messageId: savedMessages.messageId })
    .from(savedMessages)
    .where(and(eq(savedMessages.userId, userId), eq(savedMessages.messageId, messageId)))
    .limit(1);
  return !!row;
}
