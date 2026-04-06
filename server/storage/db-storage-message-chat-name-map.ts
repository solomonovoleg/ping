import type { Chat, User } from "@shared/schema";
import { buildTrackListChatNameMap } from "./db-storage-track-chat-name-map";

type MessageListChatNameContext = {
  getChatById: (id: string) => Promise<Chat | undefined>;
  getChatMemberIds: (id: string) => Promise<string[]>;
  getUser: (id: string) => Promise<User | undefined>;
};

/**
 * Имена чатов для списков сообщений (поиск, избранное и т.д.) — та же семантика, что для треков,
 * без ветки «созвон» (пустой массив callRows).
 */
export async function buildChatNameMapForMessageRows(
  userId: string,
  rows: { chatId: string }[],
  ctx: MessageListChatNameContext,
): Promise<Map<string, string>> {
  return buildTrackListChatNameMap(userId, rows, [], ctx);
}
