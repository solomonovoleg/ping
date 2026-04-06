import { eq, and, desc } from "drizzle-orm";
import type { Pool } from "pg";
import type { Chat, ChatMember, InsertChat, InsertChatMember } from "@shared/schema";
import { chats, chatMembers, chatMemberPrefs } from "@shared/schema";
import {
  FIND_DM_CHAT_BETWEEN_USERS_LOOSE_SQL,
  FIND_DM_CHAT_BETWEEN_USERS_STRICT_SQL,
} from "./db-storage-dm-chat-lookup-sql";
import { buildChatMetadataUpdatePatch } from "./db-storage-chat-metadata-update-patch";
import { mergeChatMemberPrefsForUpsert } from "./db-storage-chat-member-prefs-merge";
import {
  chatMemberPrefsRowsToMap,
  isPostgresUndefinedTableError,
} from "./db-storage-chat-member-prefs-map";
import type { AppDb } from "./db-app-db";

export async function dbStorageGetChatById(db: AppDb, id: string): Promise<Chat | undefined> {
  const [row] = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  return row;
}

export async function dbStorageGetChatMember(
  db: AppDb,
  chatId: string,
  userId: string,
): Promise<ChatMember | undefined> {
  const [row] = await db
    .select()
    .from(chatMembers)
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
    .limit(1);
  return row;
}

export async function dbStorageGetChatMemberIds(db: AppDb, chatId: string): Promise<string[]> {
  const rows = await db.select({ userId: chatMembers.userId }).from(chatMembers).where(eq(chatMembers.chatId, chatId));
  return rows.map((r) => r.userId);
}

export async function dbStorageGetChatsForUser(db: AppDb, userId: string): Promise<Chat[]> {
  const rows = await db
    .select({ chat: chats })
    .from(chatMembers)
    .innerJoin(chats, eq(chatMembers.chatId, chats.id))
    .where(eq(chatMembers.userId, userId))
    .orderBy(desc(chats.createdAt));
  return rows.map((r) => r.chat);
}

export async function dbStorageGetChatMemberPrefsForUser(
  db: AppDb,
  userId: string,
): Promise<Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>> {
  try {
    const rows = await db.select().from(chatMemberPrefs).where(eq(chatMemberPrefs.userId, userId));
    return chatMemberPrefsRowsToMap(rows);
  } catch (err: unknown) {
    if (isPostgresUndefinedTableError(err)) {
      console.warn(
        "[db] Таблица chat_member_prefs отсутствует — выполните миграции (scripts/migrate-chat-member-prefs.cjs / деплой). Список чатов без закреплений/скрытых.",
      );
      return new Map();
    }
    throw err;
  }
}

export async function dbStorageUpsertChatMemberPrefs(
  db: AppDb,
  userId: string,
  chatId: string,
  patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string },
): Promise<void> {
  const [row] = await db
    .select()
    .from(chatMemberPrefs)
    .where(and(eq(chatMemberPrefs.chatId, chatId), eq(chatMemberPrefs.userId, userId)))
    .limit(1);
  const merged = mergeChatMemberPrefsForUpsert(chatId, userId, patch, row, new Date());
  await db
    .insert(chatMemberPrefs)
    .values(merged)
    .onConflictDoUpdate({
      target: [chatMemberPrefs.chatId, chatMemberPrefs.userId],
      set: {
        pinnedAt: merged.pinnedAt,
        hiddenAt: merged.hiddenAt,
        listSection: merged.listSection,
        updatedAt: merged.updatedAt,
      },
    });
}

export async function dbStorageDeleteChatCascade(db: AppDb, chatId: string): Promise<boolean> {
  const del = await db.delete(chats).where(eq(chats.id, chatId)).returning({ id: chats.id });
  return del.length > 0;
}

export async function dbStorageDeleteChatMemberPrefs(
  db: AppDb,
  userId: string,
  chatId: string,
): Promise<void> {
  await db
    .delete(chatMemberPrefs)
    .where(and(eq(chatMemberPrefs.chatId, chatId), eq(chatMemberPrefs.userId, userId)));
}

export async function dbStorageGetOrCreateDmChat(
  pool: Pool,
  getChatById: (id: string) => Promise<Chat | undefined>,
  userId: string,
  otherUserId: string,
): Promise<Chat> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let existingId: string | undefined;
    const strict = await client.query<{ id: string }>(FIND_DM_CHAT_BETWEEN_USERS_STRICT_SQL, [userId, otherUserId]);
    existingId = strict.rows[0]?.id;
    if (!existingId) {
      const loose = await client.query<{ id: string; mc: string | number }>(
        FIND_DM_CHAT_BETWEEN_USERS_LOOSE_SQL,
        [userId, otherUserId],
      );
      const row = loose.rows[0];
      const mc = row ? Number(row.mc) : 0;
      if (row && mc === 2) {
        existingId = row.id;
      }
    }
    if (existingId) {
      await client.query("COMMIT");
      const chat = await getChatById(existingId);
      if (chat) return chat;
    }

    const ins = await client.query<Chat>(
      `INSERT INTO chats (type, name) VALUES ('dm', NULL)
         RETURNING id, type, name, avatar_url, created_at`,
    );
    const chat = ins.rows[0];
    if (!chat) throw new Error("Create chat failed");
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'admin'), ($1, $3, 'member')`,
      [chat.id, userId, otherUserId],
    );
    await client.query("COMMIT");
    return chat;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function dbStorageGetChatByInviteCode(db: AppDb, code: string): Promise<Chat | undefined> {
  const [row] = await db.select().from(chats).where(eq(chats.inviteCode, code)).limit(1);
  return row;
}

export async function dbStorageGetChatByShortCode(db: AppDb, code: string): Promise<Chat | undefined> {
  const [row] = await db.select().from(chats).where(eq(chats.shortCode, code)).limit(1);
  return row;
}

export async function dbStorageCreateChat(db: AppDb, data: InsertChat): Promise<Chat> {
  const [row] = await db.insert(chats).values(data).returning();
  if (!row) throw new Error("Insert chat failed");
  return row;
}

export async function dbStorageAddChatMember(db: AppDb, data: InsertChatMember): Promise<ChatMember> {
  const [row] = await db.insert(chatMembers).values(data).returning();
  if (!row) throw new Error("Insert chat member failed");
  return row;
}

export async function dbStorageRemoveChatMember(db: AppDb, chatId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(chatMembers)
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function dbStorageUpdateChat(
  db: AppDb,
  chatId: string,
  data: {
    name?: string;
    avatarUrl?: string;
    shortCode?: string | null;
    inviteCode?: string | null;
    dmMultilingualEnabled?: boolean;
  },
  getChatById: (id: string) => Promise<Chat | undefined>,
): Promise<Chat | undefined> {
  const updates = buildChatMetadataUpdatePatch(data);
  if (Object.keys(updates).length === 0) return getChatById(chatId);
  const [row] = await db.update(chats).set(updates).where(eq(chats.id, chatId)).returning();
  return row;
}
