/** Сегмент `DbStorage`: чаты, участники, prefs, DM. */
import type { Chat, ChatListSection, ChatMember, InsertChat, InsertChatMember } from "@shared/schema";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageAddChatMember,
  dbStorageCreateChat,
  dbStorageDeleteChatCascade,
  dbStorageDeleteChatMemberPrefs,
  dbStorageGetChatByInviteCode,
  dbStorageGetChatByShortCode,
  dbStorageGetChatById,
  dbStorageGetChatMember,
  dbStorageGetChatMemberIds,
  dbStorageGetChatMemberPrefsForUser,
  dbStorageGetChatsForUser,
  dbStorageGetOrCreateDmChat,
  dbStorageRemoveChatMember,
  dbStorageUpdateChat,
  dbStorageUpsertChatMemberPrefs,
  dbStorageCreateUserChatListCustomFolder,
  dbStorageDeleteUserChatListCustomFolder,
  dbStorageGetChatMemberListSection,
  dbStorageGetUserChatListCustomFolder,
  dbStorageIsChatListSectionPushMutedForUser,
  dbStorageListUserChatListBuiltinTabPrefs,
  dbStorageListUserChatListCustomFolders,
  dbStorageNextUserChatListCustomFolderSortOrder,
  dbStorageResetUserChatMemberPrefsListSection,
  dbStorageUpdateUserChatListCustomFolder,
  dbStorageUpsertUserChatListBuiltinTabPrefs,
} from "./db-storage-facade-queries";

export const dbStorageSegmentChat = {
  getChatById(host: DbStorageSegmentHost, id: string): Promise<Chat | undefined> {
    return dbStorageGetChatById(host.db, id);
  },

  getChatByInviteCode(host: DbStorageSegmentHost, code: string): Promise<Chat | undefined> {
    return dbStorageGetChatByInviteCode(host.db, code);
  },

  getChatByShortCode(host: DbStorageSegmentHost, code: string): Promise<Chat | undefined> {
    return dbStorageGetChatByShortCode(host.db, code);
  },

  getChatMember(host: DbStorageSegmentHost, chatId: string, userId: string): Promise<ChatMember | undefined> {
    return dbStorageGetChatMember(host.db, chatId, userId);
  },

  getChatMemberIds(host: DbStorageSegmentHost, chatId: string): Promise<string[]> {
    return dbStorageGetChatMemberIds(host.db, chatId);
  },

  getChatsForUser(host: DbStorageSegmentHost, userId: string): Promise<Chat[]> {
    return dbStorageGetChatsForUser(host.db, userId);
  },

  getChatMemberPrefsForUser(
    host: DbStorageSegmentHost,
    userId: string,
  ): Promise<Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>> {
    return dbStorageGetChatMemberPrefsForUser(host.db, userId);
  },

  upsertChatMemberPrefs(
    host: DbStorageSegmentHost,
    userId: string,
    chatId: string,
    patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string },
  ): Promise<void> {
    return dbStorageUpsertChatMemberPrefs(host.db, userId, chatId, patch);
  },

  deleteChatCascade(host: DbStorageSegmentHost, chatId: string): Promise<boolean> {
    return dbStorageDeleteChatCascade(host.db, chatId);
  },

  deleteChatMemberPrefs(host: DbStorageSegmentHost, userId: string, chatId: string): Promise<void> {
    return dbStorageDeleteChatMemberPrefs(host.db, userId, chatId);
  },

  getChatMemberListSection(host: DbStorageSegmentHost, userId: string, chatId: string): Promise<string> {
    return dbStorageGetChatMemberListSection(host.db, userId, chatId);
  },

  isChatListSectionPushMutedForUser(host: DbStorageSegmentHost, userId: string, section: string): Promise<boolean> {
    return dbStorageIsChatListSectionPushMutedForUser(host.db, userId, section);
  },

  listUserChatListCustomFolders(host: DbStorageSegmentHost, userId: string) {
    return dbStorageListUserChatListCustomFolders(host.db, userId);
  },

  getUserChatListCustomFolder(host: DbStorageSegmentHost, userId: string, folderId: string) {
    return dbStorageGetUserChatListCustomFolder(host.db, userId, folderId);
  },

  listUserChatListBuiltinTabPrefs(host: DbStorageSegmentHost, userId: string) {
    return dbStorageListUserChatListBuiltinTabPrefs(host.db, userId);
  },

  nextUserChatListCustomFolderSortOrder(host: DbStorageSegmentHost, userId: string): Promise<number> {
    return dbStorageNextUserChatListCustomFolderSortOrder(host.db, userId);
  },

  createUserChatListCustomFolder(
    host: DbStorageSegmentHost,
    userId: string,
    id: string,
    name: string,
    sortOrder: number,
  ): Promise<void> {
    return dbStorageCreateUserChatListCustomFolder(host.db, userId, id, name, sortOrder);
  },

  updateUserChatListCustomFolder(
    host: DbStorageSegmentHost,
    userId: string,
    folderId: string,
    patch: { name?: string; pushMuted?: boolean },
  ): Promise<boolean> {
    return dbStorageUpdateUserChatListCustomFolder(host.db, userId, folderId, patch);
  },

  deleteUserChatListCustomFolder(host: DbStorageSegmentHost, userId: string, folderId: string): Promise<boolean> {
    return dbStorageDeleteUserChatListCustomFolder(host.db, userId, folderId);
  },

  resetUserChatMemberPrefsListSection(
    host: DbStorageSegmentHost,
    userId: string,
    fromSection: string,
    toSection: string,
  ): Promise<void> {
    return dbStorageResetUserChatMemberPrefsListSection(host.db, userId, fromSection, toSection);
  },

  upsertUserChatListBuiltinTabPrefs(
    host: DbStorageSegmentHost,
    userId: string,
    tabId: ChatListSection,
    patch: { labelOverride?: string | null; pushMuted?: boolean },
  ): Promise<void> {
    return dbStorageUpsertUserChatListBuiltinTabPrefs(host.db, userId, tabId, patch);
  },

  getOrCreateDmChat(host: DbStorageSegmentHost, userId: string, otherUserId: string): Promise<Chat> {
    return dbStorageGetOrCreateDmChat(host.pool, host.facadeCallbacks.getChatById, userId, otherUserId);
  },

  createChat(host: DbStorageSegmentHost, data: InsertChat): Promise<Chat> {
    return dbStorageCreateChat(host.db, data);
  },

  addChatMember(host: DbStorageSegmentHost, data: InsertChatMember): Promise<ChatMember> {
    return dbStorageAddChatMember(host.db, data);
  },

  removeChatMember(host: DbStorageSegmentHost, chatId: string, userId: string): Promise<boolean> {
    return dbStorageRemoveChatMember(host.db, chatId, userId);
  },

  updateChat(
    host: DbStorageSegmentHost,
    chatId: string,
    data: {
      name?: string;
      avatarUrl?: string;
      shortCode?: string | null;
      inviteCode?: string | null;
      dmMultilingualEnabled?: boolean;
    },
  ): Promise<Chat | undefined> {
    return dbStorageUpdateChat(host.db, chatId, data, host.facadeCallbacks.getChatById);
  },
};
