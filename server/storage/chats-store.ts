import type { Chat, ChatMember, InsertChat, InsertChatMember } from "@shared/schema";
import { randomUUID } from "crypto";

export interface ChatsStore {
  getById(id: string): Chat | undefined;
  getByUserId(userId: string): Chat[];
  /** Найти личный чат (dm) между двумя пользователями. */
  getDmBetween(userId1: string, userId2: string): Chat | undefined;
  create(data: InsertChat): Chat;
  addMember(data: InsertChatMember): ChatMember;
  getMember(chatId: string, userId: string): ChatMember | undefined;
  getMemberIds(chatId: string): string[];
  setLastRead(chatId: string, userId: string, at: Date): void;
}

export function createChatsStore(): ChatsStore {
  const chats = new Map<string, Chat>();
  const members = new Map<string, ChatMember[]>();

  return {
    getById(id: string) {
      return chats.get(id);
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
  };
}
