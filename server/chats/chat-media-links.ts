import { storage } from "../storage";
import { ChatsServiceError } from "./chats-service-error";

const URL_REGEX = /https?:\/\/[^\s<>]+/g;

export async function getChatMediaForUser(
  userId: string,
  chatId: string,
  folderId: string | null,
  limit: number,
  beforeMessageId?: string,
) {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const rows = await storage.getMediaMessages(chatId, folderId, Math.min(limit, 50), beforeMessageId);
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    content: m.content,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  }));
}

export async function getChatLinksForUser(
  userId: string,
  chatId: string,
  folderId: string | null,
  limit: number,
  beforeMessageId?: string,
) {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const rows = await storage.getTextMessagesForLinks(chatId, folderId, Math.min(limit, 100), beforeMessageId);
  const links: { url: string; messageId: string; createdAt: string }[] = [];
  for (const row of rows) {
    const matches = row.content.match(URL_REGEX);
    if (matches) {
      const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
      for (const url of matches) {
        links.push({ url, messageId: row.id, createdAt });
        if (links.length >= 50) break;
      }
    }
    if (links.length >= 50) break;
  }
  return links;
}
