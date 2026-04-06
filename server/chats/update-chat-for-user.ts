import { storage } from "../storage";

export async function updateChatForUser(
  userId: string,
  chatId: string,
  data: { name?: string; avatarUrl?: string },
) {
  const chat = await storage.getChatById(chatId);
  if (!chat) return undefined;
  const memberIds = await storage.getChatMemberIds(chat.id);
  if (!memberIds.includes(userId)) return undefined;
  if (chat.type !== "group" && chat.type !== "business") return undefined;
  const updated = await storage.updateChat(chatId, data);
  return updated;
}
