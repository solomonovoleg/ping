import { notifyChatListUpdate } from "../calls/ws";
import { storage } from "../storage";
import { ChatsServiceError } from "./chats-service-error";

export async function leaveChatForUser(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа к чату");
  await storage.removeChatMember(chatId, userId);
  await storage.deleteChatMemberPrefs(userId, chatId);
  for (const mid of memberIds) {
    notifyChatListUpdate(mid);
  }
  return { ok: true };
}

export async function deleteChatForEveryoneForUser(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа к чату");

  if (chat.type === "dm") {
    if (memberIds.length !== 2) {
      throw new ChatsServiceError(400, "Некорректный личный чат");
    }
    const otherId = memberIds.find((id) => id !== userId);
    const ok = await storage.deleteChatCascade(chatId);
    if (!ok) throw new ChatsServiceError(500, "Не удалось удалить чат");
    notifyChatListUpdate(userId);
    if (otherId) notifyChatListUpdate(otherId);
    return { ok: true };
  }

  if (chat.type === "group") {
    const m = await storage.getChatMember(chatId, userId);
    if (!m || m.role !== "admin") {
      throw new ChatsServiceError(403, "Только администратор может удалить группу для всех");
    }
    const ok = await storage.deleteChatCascade(chatId);
    if (!ok) throw new ChatsServiceError(500, "Не удалось удалить чат");
    for (const mid of memberIds) {
      notifyChatListUpdate(mid);
    }
    return { ok: true };
  }

  if (chat.type === "business") {
    const ok = await storage.deleteChatCascade(chatId);
    if (!ok) throw new ChatsServiceError(500, "Не удалось удалить чат");
    notifyChatListUpdate(userId);
    return { ok: true };
  }

  throw new ChatsServiceError(400, "Неподдерживаемый тип чата");
}
