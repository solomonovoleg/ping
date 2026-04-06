import { notifyChatListUpdate } from "../calls/ws";
import { storage } from "../storage";
import { targetAllowsGroupAddFromActor } from "../users/social-policy";
import { ChatsServiceError } from "./chats-service-error";
import { getChatByIdForUser } from "./get-chat-by-id";

export async function addMemberToGroup(actorUserId: string, chatId: string, newUserId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  if (chat.type !== "group") throw new ChatsServiceError(400, "Некорректный чат");
  const actorMember = await storage.getChatMember(chatId, actorUserId);
  if (!actorMember || actorMember.role !== "admin") throw new ChatsServiceError(403, "Только администратор может добавлять участников");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (memberIds.includes(newUserId)) throw new ChatsServiceError(400, "Пользователь уже в группе");
  const other = await storage.getUser(newUserId);
  if (!other) throw new ChatsServiceError(404, "Пользователь не найден");
  const groupOk = await targetAllowsGroupAddFromActor(actorUserId, newUserId);
  if (!groupOk) {
    throw new ChatsServiceError(
      403,
      "Пользователь ограничил, кто может добавлять его в групповые чаты (нужна подписка или взаимная подписка)",
    );
  }
  await storage.addChatMember({ chatId, userId: newUserId, role: "member" });
  notifyChatListUpdate(newUserId);
  return getChatByIdForUser(actorUserId, chatId);
}

export async function removeMemberFromGroup(actorUserId: string, chatId: string, targetUserId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  if (chat.type !== "group") throw new ChatsServiceError(400, "Некорректный чат");
  const actorMember = await storage.getChatMember(chatId, actorUserId);
  if (!actorMember || actorMember.role !== "admin") throw new ChatsServiceError(403, "Только администратор может исключать участников");
  if (actorUserId === targetUserId) throw new ChatsServiceError(400, "Нельзя исключить себя");
  const removed = await storage.removeChatMember(chatId, targetUserId);
  if (!removed) throw new ChatsServiceError(404, "Участник не найден");
  notifyChatListUpdate(targetUserId);
  return getChatByIdForUser(actorUserId, chatId);
}
