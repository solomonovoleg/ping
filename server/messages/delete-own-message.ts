import { DELETE_FOR_EVERYONE_MINUTES } from "@shared/constants";
import { storage } from "../storage";
import { scheduleApiHubBridgeMessageDeleted } from "../integrations/api-hub-bridge";
import { notifyMessageDeleted } from "../realtime/chat";
import { MessagesServiceError } from "./messages-service-error";

export async function deleteOwnMessage(
  userId: string,
  chatId: string,
  messageId: string,
  forEveryone?: boolean,
) {
  const msg = await storage.getMessage(chatId, messageId);
  if (!msg) {
    throw new MessagesServiceError(404, "Сообщение не найдено");
  }
  if (msg.senderId !== userId) {
    throw new MessagesServiceError(403, "Можно удалить только своё сообщение");
  }
  const createdAt = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
  const ageMinutes = (Date.now() - createdAt.getTime()) / 60_000;
  if (forEveryone && ageMinutes <= DELETE_FOR_EVERYONE_MINUTES) {
    const memberIds = await storage.getChatMemberIds(chatId);
    const deleted = await storage.deleteMessage(chatId, messageId);
    if (!deleted) {
      throw new MessagesServiceError(500, "Не удалось удалить");
    }
    notifyMessageDeleted(chatId, messageId);
    scheduleApiHubBridgeMessageDeleted(chatId, messageId, memberIds);
  } else {
    await storage.addMessageHidden(userId, chatId, messageId);
  }
}
