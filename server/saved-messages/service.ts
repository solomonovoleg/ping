import { storage } from "../storage";

export type ServiceErrorCode = "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND";

export class SavedMessagesServiceError extends Error {
  code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function listSavedMessages(userId: string, limit: number, offset: number) {
  const list = await storage.listSavedMessages(userId, limit, offset);
  return list.map((r) => ({ ...r, savedAt: r.savedAt.toISOString() }));
}

export async function saveMessageForUser(userId: string, messageId: string, chatId: string): Promise<void> {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) {
    throw new SavedMessagesServiceError("FORBIDDEN", "Нет доступа к чату");
  }
  const msg = await storage.getMessage(chatId, messageId.trim());
  if (!msg) {
    throw new SavedMessagesServiceError("NOT_FOUND", "Сообщение не найдено");
  }
  await storage.saveMessage(userId, msg.id, chatId);
}

export async function unsaveMessageForUser(userId: string, messageId: string): Promise<void> {
  await storage.unsaveMessage(userId, messageId);
}

export async function isMessageSavedByUser(userId: string, messageId: string): Promise<boolean> {
  return storage.isMessageSaved(userId, messageId);
}
