import { sendUserRealtimePayload } from "../calls/ws";
import { storage } from "../storage";
import { markServiceStepRead } from "../service-chat/service";
import { ChatsServiceError } from "./chats-service-error";

export async function markChatRead(chatId: string, userId: string, messageId?: string): Promise<void> {
  const chat = await storage.getChatById(chatId);
  if (!chat) {
    throw new ChatsServiceError(404, "Чат не найден");
  }
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) {
    throw new ChatsServiceError(403, "Нет доступа к чату");
  }
  if (!messageId) return;
  const msg = await storage.getMessage(chatId, messageId);
  if (!msg) return;
  /* Курсор чтения только по чужим сообщениям; system — служебное. missed_call — «входящее» для получателя (sender_id null). */
  if (msg.type === "system") return;
  if (msg.senderId === userId) return;
  /* last_read_at монотонно не уменьшается (GREATEST в updateLastReadByMessageId); WS chat-read несёт актуальный курсор. */
  await storage.updateLastReadByMessageId(chatId, userId, messageId);
  await markServiceStepRead(chatId, messageId);
  const lastReadAt = await storage.getChatMemberLastReadAt(chatId, userId);
  if (lastReadAt) {
    const iso = lastReadAt.toISOString();
    const readPayload = { type: "chat-read" as const, chatId, readerId: userId, lastReadAt: iso };
    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      sendUserRealtimePayload(memberId, readPayload);
    }
  }
}
