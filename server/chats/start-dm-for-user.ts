import { notifyChatListUpdate } from "../calls/ws";
import { storage } from "../storage";
import { viewerMayDmTarget } from "../users/social-policy";
import { ChatsServiceError } from "./chats-service-error";
import { buildDmChatPayload } from "./chat-dm-payload";

export async function startDmForUser(userId: string, otherUserId: string) {
  if (!otherUserId || otherUserId === userId) {
    throw new ChatsServiceError(400, "Укажите ID пользователя для начала диалога");
  }
  const other = await storage.getUser(otherUserId);
  if (!other) {
    throw new ChatsServiceError(404, "Пользователь не найден");
  }
  const mayDm = await viewerMayDmTarget(userId, otherUserId);
  if (!mayDm) {
    throw new ChatsServiceError(
      403,
      "Пользователь ограничил, кто может писать ему в личные сообщения",
    );
  }
  const chat = await storage.getOrCreateDmChat(userId, otherUserId);
  notifyChatListUpdate(otherUserId);
  return buildDmChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);
}
