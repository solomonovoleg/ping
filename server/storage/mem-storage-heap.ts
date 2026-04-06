/**
 * Общее изменяемое состояние для `MemStorage` (карты и массивы вне инстанса класса).
 * Вынесено в один модуль, чтобы `mem-storage.ts` держал оркестрацию, а данные — отдельно.
 */
import type { ChatFolder } from "@shared/schema";
import type { UserReminder, VoiceTask } from "@shared/schema";

export type MemBlockFlags = {
  restrictProfile: boolean;
  restrictChat: boolean;
  restrictSocial: boolean;
  blockNote: string | null;
};

export function memBlockFull(f: MemBlockFlags): boolean {
  return f.restrictProfile === true && f.restrictChat === true && f.restrictSocial === true;
}

/** In-memory contacts: ownerId -> Set of contactUserId */
export const contactsMap = new Map<string, Set<string>>();

/** In-memory folders: chatId -> ChatFolder[] */
export const foldersByChat = new Map<string, ChatFolder[]>();

/** In-memory follows: followerId -> Set of followingId */
export const followsMap = new Map<string, Set<string>>();

/** In-memory blocks: blockerId -> blockedId -> flags */
export const blocksMap = new Map<string, Map<string, MemBlockFlags>>();

/** «Удалено для себя»: key = `${userId}:${chatId}` -> Set<messageId> */
export const messageHiddenMap = new Map<string, Set<string>>();

/** key = `${userId}\t${chatId}` */
export const chatMemberPrefsMem = new Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>();

export function chatMemberPrefsKey(userId: string, chatId: string): string {
  return `${userId}\t${chatId}`;
}

/** userId -> кастомные полки списка чатов */
export type MemUserChatListCustomFolder = {
  id: string;
  name: string;
  sortOrder: number;
  pushMuted: boolean;
  createdAt: Date;
};
export const userChatListCustomFoldersByUserMem = new Map<string, MemUserChatListCustomFolder[]>();

/** key `${userId}\t${tabId}` — встроенные полки */
export const userChatListBuiltinTabPrefsMem = new Map<
  string,
  { labelOverride: string | null; pushMuted: boolean }
>();

export function userChatListBuiltinTabPrefsKey(userId: string, tabId: string): string {
  return `${userId}\t${tabId}`;
}

export const memUserReminders: UserReminder[] = [];
export const memVoiceTasks: VoiceTask[] = [];

export type MemDmScheduledCall = {
  id: string;
  chatId: string;
  createdByUserId: string;
  peerUserId: string;
  fireAt: Date;
  title: string;
  plannerReminderId: string | null;
  initiatorDismissedAt: Date | null;
  peerDismissedAt: Date | null;
};

export const memDmScheduledCalls: MemDmScheduledCall[] = [];
