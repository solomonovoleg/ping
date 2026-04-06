/**
 * Модуль «Ответ на сообщение» (п.6 VS_TELEGRAM_20).
 * Обогащение списка сообщений полем replyTo (батч к БД, без N+1).
 */

import type { Message } from "@shared/schema";

export type ReplySnapshot = {
  id: string;
  senderId: string | null;
  type: string;
  content: string;
};

export type MessageWithReply = Message & {
  replyTo?: ReplySnapshot;
};

/** Загрузить сообщения чата по id ответов — один round-trip. */
export type LoadRepliesBatchFn = (chatId: string, replyToIds: string[]) => Promise<Map<string, Message>>;

let replyColumnEnsured = false;

/** Добавляет колонку reply_to_id в messages, если её нет. */
export async function ensureReplySchema(pool: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  if (replyColumnEnsured) return;
  try {
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL");
    replyColumnEnsured = true;
  } catch (e) {
    console.error("[reply] ensureReplySchema failed:", e);
  }
}

function snapshotFromReplied(replied: Message): ReplySnapshot {
  return {
    id: replied.id,
    senderId: replied.senderId ?? null,
    type: replied.type,
    content:
      replied.type === "text"
        ? String(replied.content).slice(0, 200)
        : replied.type === "file"
          ? (() => {
              try {
                const p = JSON.parse(String(replied.content)) as { name?: string };
                const n = typeof p.name === "string" ? p.name.trim() : "";
                return n.slice(0, 120) || "PDF-документ";
              } catch {
                return "PDF-документ";
              }
            })()
          : replied.type,
  };
}

/** Обогащает сообщения полем replyTo; replyTo подгружаются одним батчем. */
export async function enrichMessagesWithReply(
  messages: (Message & { replyToId?: string | null })[],
  loadReplies: LoadRepliesBatchFn,
): Promise<MessageWithReply[]> {
  const chatId = messages.find((m) => m.chatId)?.chatId;
  if (!chatId) {
    return messages.map((m) => ({ ...m } as MessageWithReply));
  }
  const idSet = new Set<string>();
  for (const m of messages) {
    if (m.replyToId) idSet.add(m.replyToId);
  }
  const replyIds = [...idSet];
  const byId = replyIds.length > 0 ? await loadReplies(chatId, replyIds) : new Map<string, Message>();
  return messages.map((msg) => {
    const base = { ...msg } as MessageWithReply;
    if (msg.replyToId && msg.chatId) {
      const replied = byId.get(msg.replyToId);
      if (replied) base.replyTo = snapshotFromReplied(replied);
    }
    return base;
  });
}
