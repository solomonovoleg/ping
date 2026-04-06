import { storage } from "../storage";
import { MessagesServiceError } from "./messages-service-error";

export async function ensureChatAccess(userId: string, chatId: string): Promise<string[]> {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) {
    throw new MessagesServiceError(403, "Нет доступа к чату");
  }
  return memberIds;
}
