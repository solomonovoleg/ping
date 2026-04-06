import type { Chat } from "@shared/schema";
import { formatTrackCallSessionChatTitle } from "./db-storage-chat-title-for-tracks";

export async function buildCallSessionListChatNameMap(
  rows: { chatId: string }[],
  getChatById: (id: string) => Promise<Chat | undefined>,
): Promise<Map<string, string>> {
  const chatMap = new Map<string, string>();
  for (const row of rows) {
    if (chatMap.has(row.chatId)) continue;
    const chat = await getChatById(row.chatId);
    chatMap.set(row.chatId, formatTrackCallSessionChatTitle(chat));
  }
  return chatMap;
}
