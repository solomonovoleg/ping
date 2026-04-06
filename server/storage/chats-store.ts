import type { Chat, ChatMember, InsertChat, InsertChatMember } from "@shared/schema";
import { randomUUID } from "crypto";

export interface ChatsStore {
  getById(id: string): Chat | undefined;
  getByShortCode(shortCode: string): Chat | undefined;
  getByUserId(userId: string): Chat[];
  /** Найти личный чат (dm) между двумя пользователями. */
  getDmBetween(userId1: string, userId2: string): Chat | undefined;
  create(data: InsertChat): Chat;
  addMember(data: InsertChatMember): ChatMember;
  removeMember(chatId: string, userId: string): boolean;
  update(chatId: string, data: {
    name?: string;
    avatarUrl?: string;
    shortCode?: string | null;
    inviteCode?: string | null;
    dmMultilingualEnabled?: boolean;
  }): Chat | undefined;
  getMember(chatId: string, userId: string): ChatMember | undefined;
  getMemberIds(chatId: string): string[];
  setLastRead(chatId: string, userId: string, at: Date): void;
  /** Удалить чат и всех участников из памяти. */
  deleteChat(chatId: string): boolean;
}

export function createChatsStore(): ChatsStore {
  const chats = new Map<string, Chat>();
  const members = new Map<string, ChatMember[]>();

  return {
    getById(id: string) {
      return chats.get(id);
    },
    getByShortCode(shortCode: string) {
      const normalized = shortCode.trim().toLowerCase();
      if (!normalized) return undefined;
      for (const chat of chats.values()) {
        if ((chat.shortCode ?? "").toLowerCase() === normalized) return chat;
      }
      return undefined;
    },
    getByUserId(userId: string) {
      const result: Chat[] = [];
      Array.from(members.entries()).forEach(([chatId, list]) => {
        if (list.some((m: ChatMember) => m.userId === userId)) {
          const chat = chats.get(chatId);
          if (chat) result.push(chat);
        }
      });
      return result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    getDmBetween(userId1: string, userId2: string) {
      for (const [chatId, list] of Array.from(members.entries())) {
        const chat = chats.get(chatId);
        if (!chat || chat.type !== "dm") continue;
        const ids = new Set(list.map((m: ChatMember) => m.userId));
        if (ids.has(userId1) && ids.has(userId2) && ids.size === 2) return chat;
      }
      return undefined;
    },
    create(data: InsertChat) {
      const id = randomUUID();
      const chat: Chat = {
        id,
        type: data.type ?? "dm",
        name: data.name ?? null,
        avatarUrl: null,
        shortCode: null,
        inviteCode: null,
        dmMultilingualEnabled: false,
        createdAt: new Date(),
      };
      chats.set(id, chat);
      members.set(id, []);
      return chat;
    },
    addMember(data: InsertChatMember) {
      const id = randomUUID();
      const member: ChatMember = {
        id,
        chatId: data.chatId,
        userId: data.userId,
        role: data.role ?? "member",
        joinedAt: new Date(),
        lastReadAt: null,
      };
      const list = members.get(data.chatId) ?? [];
      list.push(member);
      members.set(data.chatId, list);
      return member;
    },
    removeMember(chatId: string, userId: string) {
      const list = members.get(chatId);
      if (!list) return false;
      const idx = list.findIndex((m) => m.userId === userId);
      if (idx < 0) return false;
      list.splice(idx, 1);
      return true;
    },
    update(chatId: string, data: {
      name?: string;
      avatarUrl?: string;
      shortCode?: string | null;
      inviteCode?: string | null;
      dmMultilingualEnabled?: boolean;
    }) {
      const chat = chats.get(chatId);
      if (!chat) return undefined;
      if (data.name !== undefined) (chat as Chat).name = data.name;
      if (data.avatarUrl !== undefined) (chat as Chat & { avatarUrl?: string }).avatarUrl = data.avatarUrl;
      if (data.shortCode !== undefined) (chat as Chat & { shortCode?: string | null }).shortCode = data.shortCode;
      if (data.inviteCode !== undefined)
        (chat as Chat & { inviteCode?: string | null }).inviteCode = data.inviteCode;
      if (data.dmMultilingualEnabled !== undefined)
        (chat as Chat & { dmMultilingualEnabled?: boolean }).dmMultilingualEnabled = data.dmMultilingualEnabled;
      return chat;
    },
    getMember(chatId: string, userId: string) {
      return members.get(chatId)?.find((m) => m.userId === userId);
    },
    getMemberIds(chatId: string) {
      return (members.get(chatId) ?? []).map((m) => m.userId);
    },
    setLastRead(chatId: string, userId: string, at: Date) {
      const list = members.get(chatId);
      const m = list?.find((x) => x.userId === userId);
      if (m) m.lastReadAt = at;
    },
    deleteChat(chatId: string) {
      if (!chats.has(chatId)) return false;
      chats.delete(chatId);
      members.delete(chatId);
      return true;
    },
  };
}
