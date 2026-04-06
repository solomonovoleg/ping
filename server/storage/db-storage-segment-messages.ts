/** Сегмент `DbStorage`: сообщения, папки, отложенные, скрытые. */
import type { ChatFolder, Message, InsertMessage } from "@shared/schema";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageAddMessageHidden,
  dbStorageCreateChatFolder,
  dbStorageCreateMessage,
  dbStorageCreateScheduledMessage,
  dbStorageDeleteChatFolder,
  dbStorageDeleteMessage,
  dbStorageDeleteScheduledMessage,
  dbStorageGetChatFolder,
  dbStorageGetChatMemberLastReadAt,
  dbStorageGetHiddenMessageIdsForUserInChat,
  dbStorageGetLastMessage,
  dbStorageGetMediaMessages,
  dbStorageGetMessage,
  dbStorageGetMessagesByIdsInChat,
  dbStorageGetMessageById,
  dbStorageGetMessageCountByFolder,
  dbStorageGetMessagesByChatId,
  dbStorageGetOrCreateMainFolder,
  dbStorageGetScheduledMessagesDue,
  dbStorageGetTextMessagesForLinks,
  dbStorageGetUnreadCount,
  dbStorageGetUnreadCountByFolder,
  dbStorageListChatFolders,
  dbStorageUpdateChatFolder,
  dbStorageUpdateLastRead,
  dbStorageUpdateLastReadByMessageId,
  dbStorageUpdateMessage,
  dbStorageUpdateMessageTranscript,
} from "./db-storage-facade-queries";

export const dbStorageSegmentMessages = {
  updateLastRead(host: DbStorageSegmentHost, chatId: string, userId: string, readUpTo?: Date): Promise<void> {
    return dbStorageUpdateLastRead(host.db, chatId, userId, readUpTo);
  },

  updateLastReadByMessageId(
    host: DbStorageSegmentHost,
    chatId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    return dbStorageUpdateLastReadByMessageId(host.db, chatId, userId, messageId);
  },

  getChatMemberLastReadAt(host: DbStorageSegmentHost, chatId: string, userId: string): Promise<Date | null> {
    return dbStorageGetChatMemberLastReadAt(host.db, chatId, userId);
  },

  getUnreadCount(host: DbStorageSegmentHost, chatId: string, userId: string): Promise<number> {
    return dbStorageGetUnreadCount(host.db, chatId, userId);
  },

  getUnreadCountByFolder(
    host: DbStorageSegmentHost,
    chatId: string,
    folderId: string | null,
    userId: string,
  ): Promise<number> {
    return dbStorageGetUnreadCountByFolder(host.db, chatId, folderId, userId);
  },

  getMessageCountByFolder(host: DbStorageSegmentHost, chatId: string, folderId: string): Promise<number> {
    return dbStorageGetMessageCountByFolder(host.db, chatId, folderId);
  },

  getMessagesByChatId(
    host: DbStorageSegmentHost,
    chatId: string,
    limit = 100,
    beforeMessageId?: string,
    folderId?: string | null,
  ): Promise<Message[]> {
    return dbStorageGetMessagesByChatId(host.db, chatId, limit, beforeMessageId, folderId);
  },

  getMediaMessages(
    host: DbStorageSegmentHost,
    chatId: string,
    folderId: string | null,
    limit: number,
    beforeMessageId?: string,
  ): Promise<Message[]> {
    return dbStorageGetMediaMessages(host.db, chatId, folderId, limit, beforeMessageId);
  },

  getTextMessagesForLinks(
    host: DbStorageSegmentHost,
    chatId: string,
    folderId: string | null,
    limit: number,
    beforeMessageId?: string,
  ): Promise<Pick<Message, "id" | "content" | "createdAt">[]> {
    return dbStorageGetTextMessagesForLinks(host.db, chatId, folderId, limit, beforeMessageId);
  },

  listChatFolders(host: DbStorageSegmentHost, chatId: string): Promise<ChatFolder[]> {
    return dbStorageListChatFolders(host.db, chatId);
  },

  getOrCreateMainFolder(host: DbStorageSegmentHost, chatId: string): Promise<ChatFolder> {
    return dbStorageGetOrCreateMainFolder(host.db, chatId);
  },

  createChatFolder(host: DbStorageSegmentHost, chatId: string, name: string, orderIndex: number): Promise<ChatFolder> {
    return dbStorageCreateChatFolder(host.db, chatId, name, orderIndex);
  },

  getChatFolder(host: DbStorageSegmentHost, folderId: string): Promise<ChatFolder | undefined> {
    return dbStorageGetChatFolder(host.db, folderId);
  },

  updateChatFolder(
    host: DbStorageSegmentHost,
    folderId: string,
    data: { name?: string },
  ): Promise<ChatFolder | undefined> {
    return dbStorageUpdateChatFolder(host.db, folderId, data, host.facadeCallbacks.getChatFolder);
  },

  deleteChatFolder(host: DbStorageSegmentHost, folderId: string): Promise<boolean> {
    return dbStorageDeleteChatFolder(host.db, folderId);
  },

  getLastMessage(host: DbStorageSegmentHost, chatId: string): Promise<Message | undefined> {
    return dbStorageGetLastMessage(host.db, chatId);
  },

  createMessage(host: DbStorageSegmentHost, data: InsertMessage): Promise<Message> {
    return dbStorageCreateMessage(host.db, data);
  },

  getMessage(host: DbStorageSegmentHost, chatId: string, messageId: string): Promise<Message | undefined> {
    return dbStorageGetMessage(host.db, chatId, messageId);
  },

  getMessagesByIdsInChat(host: DbStorageSegmentHost, chatId: string, messageIds: string[]): Promise<Map<string, Message>> {
    return dbStorageGetMessagesByIdsInChat(host.db, chatId, messageIds);
  },

  getMessageById(host: DbStorageSegmentHost, messageId: string): Promise<Message | undefined> {
    return dbStorageGetMessageById(host.db, messageId);
  },

  deleteMessage(host: DbStorageSegmentHost, chatId: string, messageId: string): Promise<boolean> {
    return dbStorageDeleteMessage(host.db, chatId, messageId);
  },

  updateMessage(
    host: DbStorageSegmentHost,
    chatId: string,
    messageId: string,
    content: string,
  ): Promise<Message | undefined> {
    return dbStorageUpdateMessage(host.db, chatId, messageId, content);
  },

  updateMessageTranscript(
    host: DbStorageSegmentHost,
    chatId: string,
    messageId: string,
    transcript: string,
  ): Promise<Message | undefined> {
    return dbStorageUpdateMessageTranscript(host.db, chatId, messageId, transcript);
  },

  addMessageHidden(host: DbStorageSegmentHost, userId: string, chatId: string, messageId: string): Promise<void> {
    return dbStorageAddMessageHidden(host.db, userId, chatId, messageId);
  },

  getHiddenMessageIdsForUserInChat(host: DbStorageSegmentHost, userId: string, chatId: string): Promise<string[]> {
    return dbStorageGetHiddenMessageIdsForUserInChat(host.db, userId, chatId);
  },

  createScheduledMessage(
    host: DbStorageSegmentHost,
    data: {
      chatId: string;
      folderId?: string | null;
      senderId: string;
      type: string;
      content: string;
      replyToId?: string | null;
      scheduledAt: Date;
    },
  ): Promise<{ id: string; scheduledAt: Date }> {
    return dbStorageCreateScheduledMessage(host.db, data);
  },

  getScheduledMessagesDue(
    host: DbStorageSegmentHost,
    limit: number,
  ): Promise<
    {
      id: string;
      chatId: string;
      folderId: string | null;
      senderId: string | null;
      type: string;
      content: string;
      replyToId: string | null;
    }[]
  > {
    return dbStorageGetScheduledMessagesDue(host.db, limit);
  },

  deleteScheduledMessage(host: DbStorageSegmentHost, id: string): Promise<boolean> {
    return dbStorageDeleteScheduledMessage(host.db, id);
  },
};
