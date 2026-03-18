/**
 * Чат с ИИ (AI OVER): OpenRouter, хранение последних сообщений, подгрузка контекста.
 */
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { getPool } from "../db";
import { requireAuth, getUserId } from "../auth/session";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-3.5-turbo";
const CONTEXT_MESSAGES_COUNT = 10;
const MAX_MESSAGES_PAGE = 50;

type AiMessageRow = { id: string; user_id: string; role: string; content: string; created_at: Date };

async function getAiMessages(userId: string, limit: number, beforeId: string | null): Promise<AiMessageRow[]> {
  const p = getPool();
  if (beforeId) {
    const r = await p.query<AiMessageRow>(
      `SELECT id, user_id, role, content, created_at FROM ai_chat_messages
       WHERE user_id = $1 AND created_at < (SELECT created_at FROM ai_chat_messages WHERE id = $2)
       ORDER BY created_at DESC LIMIT $3`,
      [userId, beforeId, Math.min(limit, MAX_MESSAGES_PAGE)]
    );
    return r.rows.reverse();
  }
  const r = await p.query<AiMessageRow>(
    `SELECT id, user_id, role, content, created_at FROM ai_chat_messages
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(limit, MAX_MESSAGES_PAGE)]
  );
  return r.rows.reverse();
}

async function insertAiMessage(userId: string, role: "user" | "assistant", content: string): Promise<{ id: string; createdAt: string }> {
  const p = getPool();
  const id = randomUUID();
  await p.query(
    `INSERT INTO ai_chat_messages (id, user_id, role, content) VALUES ($1, $2, $3, $4)`,
    [id, userId, role, content]
  );
  const [row] = (await p.query<{ created_at: Date }>(`SELECT created_at FROM ai_chat_messages WHERE id = $1`, [id])).rows;
  return { id, createdAt: row.created_at.toISOString() };
}

async function callOpenRouter(messages: { role: "user" | "assistant" | "system"; content: string }[]): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter: ${res.status} ${errText}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  return content;
}

export function registerAiChatRoutes(app: Express): void {
  /** Последние сообщения переписки с ИИ; ?limit=20&before=<id> — подгрузка старых */
  app.get("/api/ai-chat/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, MAX_MESSAGES_PAGE);
    const before = typeof req.query.before === "string" ? req.query.before.trim() || null : null;
    try {
      const rows = await getAiMessages(userId, limit, before);
      res.json(
        rows.map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        }))
      );
    } catch (e) {
      console.error("[ai-chat] get messages:", e);
      res.status(500).json({ message: "Не удалось загрузить историю" });
    }
  });

  /** Отправить сообщение пользователя, вызвать ИИ, сохранить оба сообщения */
  app.post("/api/ai-chat/send", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      res.status(400).json({ message: "Укажите текст сообщения" });
      return;
    }
    try {
      const userMsg = await insertAiMessage(userId, "user", content);

      const recent = await getAiMessages(userId, CONTEXT_MESSAGES_COUNT, null);
      const openRouterMessages = recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      openRouterMessages.push({ role: "user" as const, content });

      const assistantContent = await callOpenRouter(openRouterMessages);
      const assistantMsg = await insertAiMessage(userId, "assistant", assistantContent);

      res.status(201).json({
        userMessage: { id: userMsg.id, role: "user", content, createdAt: userMsg.createdAt },
        assistantMessage: { id: assistantMsg.id, role: "assistant", content: assistantContent, createdAt: assistantMsg.createdAt },
      });
    } catch (e) {
      console.error("[ai-chat] send:", e);
      res.status(500).json({ message: e instanceof Error ? e.message : "Ошибка при обращении к ИИ" });
    }
  });
}
