import type { WebSocket } from "ws";

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

/** Разослать новое сообщение всем подписчикам чата (триггер при создании сообщения). */
export function notifyNewMessage(chatId: string, message: ChatMessagePayload): void {
  const set = byChat.get(chatId);
  if (!set) return;
  const payload = JSON.stringify({ type: "chat-message", chatId, message });
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
