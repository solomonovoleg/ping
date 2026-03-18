/**
 * Модуль «Реакции на сообщения» (п.7 VS_TELEGRAM_20).
 * Один файл ≤200 строк: таблица реакций, обогащение списка сообщений, API поставить/убрать реакцию.
 */

import type { Express, Request, Response } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { messageReactions } from "@shared/schema";
import { requireAuth, getUserId } from "../auth/session";

export const ALLOWED_EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔", "😮", "😢"];

export type ReactionItem = { emoji: string; count: number };

let tableEnsured = false;

export async function ensureMessageReactionsSchema(pool: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id)
      )
    `);
    tableEnsured = true;
  } catch (e) {
    console.error("[message-reactions] ensureSchema failed:", e);
  }
}

/** Возвращает по каждому messageId список { emoji, count }. */
export async function getReactionsForMessageIds(messageIds: string[]): Promise<Map<string, ReactionItem[]>> {
  if (messageIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      messageId: messageReactions.messageId,
      emoji: messageReactions.emoji,
      count: sql<number>`count(*)::int`,
    })
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds))
    .groupBy(messageReactions.messageId, messageReactions.emoji);
  const map = new Map<string, ReactionItem[]>();
  for (const r of rows) {
    const list = map.get(r.messageId) ?? [];
    list.push({ emoji: r.emoji, count: r.count });
    map.set(r.messageId, list);
  }
  return map;
}

/** Реакция текущего пользователя на сообщение (одна на сообщение). */
export async function getMyReactionsForMessageIds(
  userId: string,
  messageIds: string[]
): Promise<Map<string, string>> {
  if (messageIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({ messageId: messageReactions.messageId, emoji: messageReactions.emoji })
    .from(messageReactions)
    .where(
      and(inArray(messageReactions.messageId, messageIds), eq(messageReactions.userId, userId))
    );
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.messageId, r.emoji);
  return map;
}

/** Обогащает сообщения полем reactions и опционально myReaction (эмодзи текущего пользователя). */
export function enrichMessagesWithReactions<T extends { id: string }>(
  messages: T[],
  reactionMap: Map<string, ReactionItem[]>,
  myReactionMap?: Map<string, string>
): (T & { reactions: ReactionItem[]; myReaction?: string | null })[] {
  return messages.map((msg) => ({
    ...msg,
    reactions: reactionMap.get(msg.id) ?? [],
    ...(myReactionMap ? { myReaction: myReactionMap.get(msg.id) ?? null } : {}),
  }));
}

type GetMessageFn = (chatId: string, messageId: string) => Promise<{ id: string } | undefined>;
type GetChatMemberIdsFn = (chatId: string) => Promise<string[]>;

export function registerMessageReactionsRoutes(
  app: Express,
  getMessage: GetMessageFn,
  getChatMemberIds: GetChatMemberIdsFn
): void {
  app.post("/api/chats/:chatId/messages/:messageId/reactions", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = (req.params.chatId ?? "").trim();
    const messageId = (req.params.messageId ?? "").trim();
    const emoji = typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";
    if (!chatId || !messageId) {
      res.status(400).json({ message: "chatId и messageId обязательны" });
      return;
    }
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      res.status(400).json({ message: "emoji: один из " + ALLOWED_EMOJIS.join(", ") });
      return;
    }
    const msg = await getMessage(chatId, messageId);
    if (!msg) {
      res.status(404).json({ message: "Сообщение не найдено" });
      return;
    }
    const memberIds = await getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) {
      res.status(403).json({ message: "Нет доступа к чату" });
      return;
    }
    try {
      const db = getDb();
      await db
        .insert(messageReactions)
        .values({ messageId, userId, emoji })
        .onConflictDoUpdate({
          target: [messageReactions.messageId, messageReactions.userId],
          set: { emoji },
        });
      res.status(204).end();
    } catch (e) {
      console.error("Message reaction add error:", e);
      res.status(500).json({ message: "Не удалось поставить реакцию" });
    }
  });

  app.delete("/api/chats/:chatId/messages/:messageId/reactions", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = (req.params.chatId ?? "").trim();
    const messageId = (req.params.messageId ?? "").trim();
    if (!chatId || !messageId) {
      res.status(400).json({ message: "chatId и messageId обязательны" });
      return;
    }
    const msg = await getMessage(chatId, messageId);
    if (!msg) {
      res.status(404).json({ message: "Сообщение не найдено" });
      return;
    }
    const memberIds = await getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) {
      res.status(403).json({ message: "Нет доступа к чату" });
      return;
    }
    try {
      const db = getDb();
      await db
        .delete(messageReactions)
        .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId)));
      res.status(204).end();
    } catch (e) {
      console.error("Message reaction delete error:", e);
      res.status(500).json({ message: "Не удалось убрать реакцию" });
    }
  });
}
