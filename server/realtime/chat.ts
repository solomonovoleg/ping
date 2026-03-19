import type { WebSocket } from "ws";
import { translate, getPref } from "../translate/provider";

/** chatId -> множество подключённых WebSocket (подписчиков чата) */
const byChat = new Map<string, Set<WebSocket>>();

function getSet(chatId: string): Set<WebSocket> {
  let set = byChat.get(chatId);
  if (!set) {
    set = new Set();
    byChat.set(chatId, set);
  }
  return set;
}

export function addSubscription(chatId: string, ws: WebSocket): void {
  getSet(chatId).add(ws);
}

export function removeSubscription(chatId: string, ws: WebSocket): void {
  const set = byChat.get(chatId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) byChat.delete(chatId);
  }
}

export function removeConnection(ws: WebSocket): void {
  byChat.forEach((set) => set.delete(ws));
}

/** Получить всех подписчиков чата (для рассылки typing и т.д.) */
export function getChatSubscribers(chatId: string): Set<WebSocket> {
  return byChat.get(chatId) ?? new Set();
}

export type ChatMessagePayload = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: string;
  content: string;
  createdAt: string;
};

/** Разослать новое сообщение всем подписчикам чата. Для подписчиков с включённым переводом — переводит перед отправкой. */
export function notifyNewMessage(chatId: string, message: ChatMessagePayload): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const originalPayload = JSON.stringify({ type: "chat-message", chatId, message });
  const isText = message.type === "text";

  set.forEach((ws) => {
    if (ws.readyState !== 1) return;
    const recipientId = (ws as WsWithUserId).userId;

    if (!isText || !recipientId || recipientId === message.senderId) {
      ws.send(originalPayload);
      return;
    }

    getPref(recipientId, chatId)
      .then((pref) => {
        if (!pref?.enabled) {
          if (ws.readyState === 1) ws.send(originalPayload);
          return "__sent__" as const;
        }
        return translate(message.content, pref.targetLang, message.id);
      })
      .then((result) => {
        if (ws.readyState !== 1) return;
        if (result === "__sent__") return;
        if (result) {
          ws.send(JSON.stringify({
            type: "chat-message",
            chatId,
            message: { ...message, translatedText: result.translatedText, detectedLang: result.detectedLang },
          }));
        } else {
          ws.send(originalPayload);
        }
      })
      .catch(() => {
        if (ws.readyState === 1) ws.send(originalPayload);
      });
  });
}

/** Уведомить подписчиков чата об удалении сообщения «для всех». */
export function notifyMessageDeleted(chatId: string, messageId: string): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const payload = JSON.stringify({ type: "message-deleted", chatId, messageId });
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

/** Уведомить подписчиков чата об изменении текста сообщения. */
export function notifyMessageEdited(chatId: string, messageId: string, content: string): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const payload = JSON.stringify({ type: "message-edited", chatId, messageId, content });
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

type WsWithUserId = WebSocket & { userId?: string };

/** Уведомить подписчиков чата о прочтении (кроме того, кто прочитал). */
export function notifyChatRead(chatId: string, readerId: string, lastReadAt: string): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const payload = JSON.stringify({ type: "chat-read", chatId, readerId, lastReadAt });
  set.forEach((ws) => {
    const w = ws as WsWithUserId;
    if (w.userId === readerId) return;
    if (ws.readyState === 1) ws.send(payload);
  });
}

/** Уведомить подписчиков чата о смене вайб-темы. */
export function notifyVibeUpdate(chatId: string, payload: Record<string, unknown>): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const json = JSON.stringify(payload);
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(json);
  });
}

export type MessageReactionItem = { emoji: string; count: number };

/** Рассылка обновления реакций на сообщение всем подписчикам чата (в т.ч. автору реакции). */
export function notifyMessageReaction(
  chatId: string,
  messageId: string,
  reactions: MessageReactionItem[],
  actorUserId: string,
  emoji: string | null
): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const payload = JSON.stringify({
    type: "message-reaction",
    chatId,
    messageId,
    reactions,
    userId: actorUserId,
    emoji,
  });
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(payload);
  });
}
