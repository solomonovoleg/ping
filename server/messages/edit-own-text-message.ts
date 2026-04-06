import { storage } from "../storage";
import { scheduleApiHubBridgeMessageEdited } from "../integrations/api-hub-bridge";
import { notifyMessageEdited } from "../realtime/chat";
import { invalidateTranslationsForMessage } from "../translate/provider";
import { MessagesServiceError } from "./messages-service-error";

export async function editOwnTextMessage(
  userId: string,
  chatId: string,
  messageId: string,
  content: string,
) {
  const msg = await storage.getMessage(chatId, messageId);
  if (!msg) {
    throw new MessagesServiceError(404, "Сообщение не найдено");
  }
  if (msg.senderId !== userId) {
    throw new MessagesServiceError(403, "Можно редактировать только своё сообщение");
  }
  if (msg.type !== "text") {
    throw new MessagesServiceError(400, "Редактировать можно только текстовые сообщения");
  }
  const updated = await storage.updateMessage(chatId, messageId, content);
  if (!updated) {
    throw new MessagesServiceError(500, "Не удалось обновить");
  }
  const memberIds = await storage.getChatMemberIds(chatId);
  await invalidateTranslationsForMessage(updated.id);
  notifyMessageEdited(chatId, updated.id, updated.content);
  scheduleApiHubBridgeMessageEdited(chatId, updated.id, updated.content, memberIds);
  return updated;
}
