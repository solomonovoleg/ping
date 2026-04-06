import { storage } from "../storage";
import { ChatsServiceError } from "./chats-service-error";
import { buildDmChatPayload } from "./chat-dm-payload";
import { buildGroupChatPayload } from "./chat-group-payload";
import { ensureGroupChatHasInviteCode } from "./chat-invite-code";

export async function getChatByIdForUser(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) {
    throw new ChatsServiceError(404, "Чат не найден");
  }
  const memberIds = await storage.getChatMemberIds(chat.id);
  if (!memberIds.includes(userId)) {
    throw new ChatsServiceError(404, "Чат не найден");
  }
  if (chat.type === "dm" && !chat.name) {
    return buildDmChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);
  }
  if (chat.type === "group") {
    const withInvite = await ensureGroupChatHasInviteCode(chat);
    return buildGroupChatPayload(chat.id, userId, withInvite as unknown as Record<string, unknown>);
  }
  return chat;
}
