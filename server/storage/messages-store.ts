import type { Message, InsertMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface MessagesStore {
  getByChatId(chatId: string, limit?: number, beforeMessageId?: string, folderId?: string | null): Message[];
  get(chatId: string, messageId: string): Message | undefined;
  create(data: InsertMessage): Message;
  delete(chatId: string, messageId: string): boolean;
  update(chatId: string, messageId: string, content: string): Message | undefined;
}

export function createMessagesStore(): MessagesStore {
  const byChat = new Map<string, Message[]>();

  return {
    getByChatId(chatId: string, limit = 100, beforeMessageId?: string, folderId?: string | null) {
      let list = byChat.get(chatId) ?? [];
      if (folderId != null) {
        list = list.filter((m) => (m as { folderId?: string | null }).folderId === folderId);
      } else {
        list = list.filter((m) => (m as { folderId?: string | null }).folderId == null);
      }
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
      const d = data as {
        type?: string;
        chatId: string;
        folderId?: string | null;
        senderId?: string | null;
        content: string;
        replyToId?: string | null;
        forwardedFromMessageId?: string | null;
        forwardedFromSenderId?: string | null;
        forwardedFromSenderName?: string | null;
      };
      const rawType: Message["type"] =
        d.type === "system" ? "system"
        : d.type === "voice" ? "voice"
        : d.type === "image" ? "image"
        : d.type === "video" ? "video"
        : d.type === "video_note" ? "video_note"
        : d.type === "missed_call" ? "missed_call"
        : d.type === "post_share" ? "post_share"
        : "text";
      const message: Message = {
        id,
        chatId: d.chatId,
        folderId: d.folderId ?? null,
        senderId: d.senderId ?? null,
        type: rawType,
        content: d.content,
        replyToId: d.replyToId ?? null,
        forwardedFromMessageId: d.forwardedFromMessageId ?? null,
        forwardedFromSenderId: d.forwardedFromSenderId ?? null,
        forwardedFromSenderName: d.forwardedFromSenderName ?? null,
        createdAt: new Date(),
      };
      const list = byChat.get(d.chatId) ?? [];
      list.push(message);
      byChat.set(d.chatId, list);
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
