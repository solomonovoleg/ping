/**
 * Модуль «Ответ на сообщение» (п.6 VS_TELEGRAM_20).
 * Один файл ≤200 строк: миграция, обогащение списка сообщений полем replyTo.
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

type GetMessageFn = (chatId: string, messageId: string) => Promise<Message | undefined>;

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

/** Обогащает сообщения полем replyTo (снимок сообщения, на которое отвечают). */
export async function enrichMessagesWithReply(
  messages: (Message & { replyToId?: string | null })[],
  getMessage: GetMessageFn
): Promise<MessageWithReply[]> {
  const out: MessageWithReply[] = [];
  for (const msg of messages) {
    const base = { ...msg } as MessageWithReply;
    if (msg.replyToId && msg.chatId) {
      const replied = await getMessage(msg.chatId, msg.replyToId);
      if (replied) {
        base.replyTo = {
          id: replied.id,
          senderId: replied.senderId ?? null,
          type: replied.type,
          content: replied.type === "text" ? String(replied.content).slice(0, 200) : replied.type,
        };
      }
    }
    out.push(base);
  }
  return out;
}
