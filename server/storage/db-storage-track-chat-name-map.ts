import type { Chat, User } from "@shared/schema";
import {
  formatTrackCallSessionChatTitle,
  formatTrackDmChatTitle,
  formatTrackGroupChatTitle,
} from "./db-storage-chat-title-for-tracks";

type TrackChatNameContext = {
  getChatById: (id: string) => Promise<Chat | undefined>;
  getChatMemberIds: (id: string) => Promise<string[]>;
  getUser: (id: string) => Promise<User | undefined>;
};

export async function buildTrackListChatNameMap(
  userId: string,
  messageRows: { chatId: string }[],
  callRows: { chatId: string }[],
  ctx: TrackChatNameContext,
): Promise<Map<string, string>> {
  const chatNames = new Map<string, string>();
  for (const row of messageRows) {
    if (chatNames.has(row.chatId)) continue;
    const chat = await ctx.getChatById(row.chatId);
    if (!chat) {
      chatNames.set(row.chatId, "Чат");
      continue;
    }
    if (chat.type === "dm") {
      const memberIds = await ctx.getChatMemberIds(chat.id);
      const otherId = memberIds.find((id) => id !== userId);
      const other = otherId ? await ctx.getUser(otherId) : null;
      chatNames.set(row.chatId, formatTrackDmChatTitle(other ?? null));
    } else {
      chatNames.set(row.chatId, formatTrackGroupChatTitle(chat));
    }
  }
  for (const row of callRows) {
    if (chatNames.has(row.chatId)) continue;
    const chat = await ctx.getChatById(row.chatId);
    chatNames.set(row.chatId, formatTrackCallSessionChatTitle(chat));
  }
  return chatNames;
}
