import { storage } from "../storage";
import { ChatsServiceError } from "./chats-service-error";

export async function listChatFoldersForUser(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  if (chat.type !== "group") return [];
  const folders = await storage.listChatFolders(chatId);
  const withUnread = await Promise.all(
    folders.map(async (f) => {
      const folderIdForUnread = f.isMain ? null : f.id;
      const unreadCount = await storage.getUnreadCountByFolder(chatId, folderIdForUnread, userId);
      const messageCount = await storage.getMessageCountByFolder(chatId, f.id);
      return {
        id: f.id,
        chatId: f.chatId,
        name: f.name,
        isMain: f.isMain,
        orderIndex: f.orderIndex,
        createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
        unreadCount,
        messageCount,
      };
    }),
  );
  return withUnread;
}

export async function createChatFolderForUser(userId: string, chatId: string, name: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  if (chat.type !== "group") throw new ChatsServiceError(400, "Папки только в групповых чатах");
  const member = await storage.getChatMember(chatId, userId);
  if (!member || member.role !== "admin") throw new ChatsServiceError(403, "Только администратор может создавать папки");
  const folders = await storage.listChatFolders(chatId);
  const folder = await storage.createChatFolder(chatId, name.trim(), folders.length);
  return {
    id: folder.id,
    chatId: folder.chatId,
    name: folder.name,
    isMain: folder.isMain,
    orderIndex: folder.orderIndex,
    createdAt: folder.createdAt instanceof Date ? folder.createdAt.toISOString() : String(folder.createdAt),
  };
}

export async function updateChatFolderForUser(userId: string, folderId: string, data: { name: string }) {
  const folder = await storage.getChatFolder(folderId);
  if (!folder) throw new ChatsServiceError(404, "Папка не найдена");
  const memberIds = await storage.getChatMemberIds(folder.chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const member = await storage.getChatMember(folder.chatId, userId);
  if (!member || member.role !== "admin") throw new ChatsServiceError(403, "Только администратор может редактировать папки");
  const updated = await storage.updateChatFolder(folderId, data);
  if (!updated) throw new ChatsServiceError(500, "Не удалось обновить");
  return {
    id: updated.id,
    chatId: updated.chatId,
    name: updated.name,
    isMain: updated.isMain,
    orderIndex: updated.orderIndex,
    createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : String(updated.createdAt),
  };
}

export async function deleteChatFolderForUser(userId: string, folderId: string) {
  const folder = await storage.getChatFolder(folderId);
  if (!folder) throw new ChatsServiceError(404, "Папка не найдена");
  const memberIds = await storage.getChatMemberIds(folder.chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const member = await storage.getChatMember(folder.chatId, userId);
  if (!member || member.role !== "admin") throw new ChatsServiceError(403, "Только администратор может удалять папки");
  const deleted = await storage.deleteChatFolder(folderId);
  if (!deleted) throw new ChatsServiceError(400, "Нельзя удалить основную папку");
  return { ok: true };
}
