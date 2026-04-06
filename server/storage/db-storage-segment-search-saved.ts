/** Сегмент `DbStorage`: поиск по сообщениям и сохранённые. */
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageIsMessageSaved,
  dbStorageListSavedMessages,
  dbStorageSaveMessage,
  dbStorageSearchMessages,
  dbStorageUnsaveMessage,
} from "./db-storage-facade-queries";

export const dbStorageSegmentSearchSaved = {
  searchMessages(
    host: DbStorageSegmentHost,
    userId: string,
    query: string,
    limit: number,
  ): Promise<{ messageId: string; chatId: string; type: string; content: string; createdAt: Date; chatName: string }[]> {
    return dbStorageSearchMessages(host.db, userId, query, limit, host.chatNameDeps());
  },

  saveMessage(host: DbStorageSegmentHost, userId: string, messageId: string, chatId: string): Promise<void> {
    return dbStorageSaveMessage(host.db, userId, messageId, chatId);
  },

  unsaveMessage(host: DbStorageSegmentHost, userId: string, messageId: string): Promise<void> {
    return dbStorageUnsaveMessage(host.db, userId, messageId);
  },

  listSavedMessages(
    host: DbStorageSegmentHost,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<
    {
      messageId: string;
      chatId: string;
      savedAt: Date;
      content: string;
      type: string;
      chatName: string;
    }[]
  > {
    return dbStorageListSavedMessages(host.db, userId, limit, offset, host.chatNameDeps());
  },

  isMessageSaved(host: DbStorageSegmentHost, userId: string, messageId: string): Promise<boolean> {
    return dbStorageIsMessageSaved(host.db, userId, messageId);
  },
};
