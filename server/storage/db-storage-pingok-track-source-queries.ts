import type { Pool } from "pg";
import type { Chat } from "@shared/schema";
import {
  PINGOK_TRACK_SOURCE_CHAT_ADD_MEMBER_SQL,
  PINGOK_TRACK_SOURCE_CHAT_FIND_SQL,
  PINGOK_TRACK_SOURCE_CHAT_INSERT_SQL,
} from "./db-storage-pingok-track-source-chat-sql";

export type PingokTrackSourceChatDeps = {
  upsertChatMemberPrefs: (
    userId: string,
    chatId: string,
    patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string },
  ) => Promise<void>;
  getChatById: (id: string) => Promise<Chat | undefined>;
};

/** Служебный чат треков Pingok: поиск/создание через pool, скрытие в списке через prefs. */
export async function dbStorageEnsurePingokTrackSourceChat(
  pool: Pool,
  userId: string,
  deps: PingokTrackSourceChatDeps,
): Promise<Chat> {
  const found = await pool.query<{ id: string }>(PINGOK_TRACK_SOURCE_CHAT_FIND_SQL, [userId]);
  let chatId = found.rows[0]?.id;
  if (!chatId) {
    const ins = await pool.query<{ id: string }>(PINGOK_TRACK_SOURCE_CHAT_INSERT_SQL);
    chatId = ins.rows[0]?.id;
    if (!chatId) throw new Error("Не удалось создать служебный чат для треков");
    await pool.query(PINGOK_TRACK_SOURCE_CHAT_ADD_MEMBER_SQL, [chatId, userId]);
  }
  await deps.upsertChatMemberPrefs(userId, chatId, { hiddenAt: new Date() });
  const chat = await deps.getChatById(chatId);
  if (!chat) throw new Error("Служебный чат треков не найден");
  return chat;
}
