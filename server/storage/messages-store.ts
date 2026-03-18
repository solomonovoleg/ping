import type { Message, InsertMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface MessagesStore {
  getByChatId(chatId: string, limit?: number, beforeMessageId?: string): Message[];
  get(chatId: string, messageId: string): Message | undefined;
  create(data: InsertMessage): Message;
  delete(chatId: string, messageId: string): boolean;
  update(chatId: string, messageId: string, content: string): Message | undefined;
}

export function createMessagesStore(): MessagesStore {
  const byChat = new Map<string, Message[]>();

  return {
    getByChatId(chatId: string, limit = 100, beforeMessageId?: string) {
      const list = byChat.get(chatId) ?? [];
      const sorted = [...list].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let slice = sorted;
      if (beforeMessageId) {
        const beforeMsg = sorted.find((m) => m.id === beforeMessageId);
        if (beforeMsg) {
          const beforeTime = new Date(beforeMsg.createdAt).getTime();
          slice = sorted.filter((m) => new Date(m.createdAt).getTime() < beforeTime);
        }
      }
      return limit ? slice.slice(-limit) : slice;
    },
    get(chatId: string, messageId: string) {
      const list = byChat.get(chatId) ?? [];
      return list.find((m) => m.id === messageId);
    },
    create(data: InsertMessage) {
      const id = randomUUID();
      const rawType =
        data.type === "system" ? "system"
        : data.type === "voice" ? "voice"
        : data.type === "image" ? "image"
        : data.type === "video" ? "video"
        : "text";
      const message: Message = {
        id,
        chatId: data.chatId,
        senderId: data.senderId ?? null,
        type: rawType,
        content: data.content,
        replyToId: (data as { replyToId?: string | null }).replyToId ?? null,
        createdAt: new Date(),
      };
      const list = byChat.get(data.chatId) ?? [];
      list.push(message);
      byChat.set(data.chatId, list);
      return message;
    },
    delete(chatId: string, messageId: string) {
      const list = byChat.get(chatId) ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx === -1) return false;
      list.splice(idx, 1);
      byChat.set(chatId, list);
      return true;
    },
    update(chatId: string, messageId: string, content: string) {
      const list = byChat.get(chatId) ?? [];
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return undefined;
      msg.content = content.trim();
      return msg;
    },
  };
}
