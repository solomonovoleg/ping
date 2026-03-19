import { randomUUID } from "crypto";
import { getPool } from "../db";

export const MAX_MESSAGES_PAGE = 50;

export type AiMessageRow = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: Date;
};

type ChatCatalogRow = {
  chat_id: string;
  type: string;
  name: string | null;
  created_at: Date | string;
  last_message_at: Date | string | null;
  other_display_name: string | null;
  other_surname: string | null;
  other_public_id: number | null;
};

export type ChatCatalogItem = {
  chatId: string;
  title: string;
  lastActivityIso: string;
};

type ScopedSearchMessageRow = {
  id: string;
  chat_id: string;
  content: string;
  created_at: Date | string;
};

export type ScopedSearchHit = {
  messageId: string;
  chatId: string;
  snippet: string;
  createdAt: string;
};

export async function fetchUserChatCatalog(userId: string): Promise<ChatCatalogItem[]> {
  const p = getPool();
  const r = await p.query<ChatCatalogRow>(
    `SELECT
       c.id AS chat_id,
       c.type,
       c.name,
       c.created_at,
       lm.created_at AS last_message_at,
       ou.display_name AS other_display_name,
       ou.surname AS other_surname,
       ou.public_id AS other_public_id
     FROM chat_members cm
     INNER JOIN chats c ON c.id = cm.chat_id
     LEFT JOIN LATERAL (
       SELECT m.created_at
       FROM messages m
       WHERE m.chat_id = c.id
       ORDER BY m.created_at DESC
       LIMIT 1
     ) lm ON TRUE
     LEFT JOIN LATERAL (
       SELECT u.display_name, u.surname, u.public_id
       FROM chat_members cm2
       INNER JOIN users u ON u.id = cm2.user_id
       WHERE cm2.chat_id = c.id
         AND cm2.user_id <> $1
       LIMIT 1
     ) ou ON TRUE
     WHERE cm.user_id = $1
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [userId],
  );

  return r.rows.map((row) => {
    const dmTitle =
      [row.other_display_name, row.other_surname].filter(Boolean).join(" ").trim() ||
      (row.other_public_id ? `ID ${row.other_public_id}` : "Диалог");
    const title = row.type === "dm" ? dmTitle : row.name?.trim() || "Группа";
    const rawTs = row.last_message_at ?? row.created_at;
    const tsIso = rawTs instanceof Date ? rawTs.toISOString() : String(rawTs);
    return {
      chatId: row.chat_id,
      title,
      lastActivityIso: tsIso,
    };
  });
}

export async function searchMessagesInChats(
  userId: string,
  chatIds: string[],
  query: string,
  limit = 20,
): Promise<ScopedSearchHit[]> {
  if (!chatIds.length) return [];
  const p = getPool();
  const like = `%${query.trim()}%`;
  const r = await p.query<ScopedSearchMessageRow>(
    `SELECT m.id, m.chat_id, m.content, m.created_at
     FROM messages m
     INNER JOIN chat_members cm
       ON cm.chat_id = m.chat_id
      AND cm.user_id = $1
     WHERE m.chat_id = ANY($2::uuid[])
       AND m.content ILIKE $3
     ORDER BY m.created_at DESC
     LIMIT $4`,
    [userId, chatIds, like, Math.min(Math.max(limit, 1), 50)],
  );
  return r.rows.map((row) => {
    const compact = row.content.replace(/\s+/g, " ").trim();
    return {
      messageId: row.id,
      chatId: row.chat_id,
      snippet: compact.length > 180 ? `${compact.slice(0, 177)}...` : compact,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  });
}

export async function fetchAiMessages(
  userId: string,
  limit: number,
  beforeId: string | null,
): Promise<AiMessageRow[]> {
  const p = getPool();
  if (beforeId) {
    const r = await p.query<AiMessageRow>(
      `SELECT id, user_id, role, content, created_at FROM ai_chat_messages
       WHERE user_id = $1 AND created_at < (SELECT created_at FROM ai_chat_messages WHERE id = $2)
       ORDER BY created_at DESC LIMIT $3`,
      [userId, beforeId, Math.min(limit, MAX_MESSAGES_PAGE)],
    );
    return r.rows.reverse();
  }
  const r = await p.query<AiMessageRow>(
    `SELECT id, user_id, role, content, created_at FROM ai_chat_messages
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(limit, MAX_MESSAGES_PAGE)],
  );
  return r.rows.reverse();
}

export async function createAiMessage(
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<{ id: string; createdAt: string }> {
  const p = getPool();
  const id = randomUUID();
  await p.query(
    `INSERT INTO ai_chat_messages (id, user_id, role, content) VALUES ($1, $2, $3, $4)`,
    [id, userId, role, content],
  );
  const [row] = (await p.query<{ created_at: Date }>(`SELECT created_at FROM ai_chat_messages WHERE id = $1`, [id])).rows;
  return { id, createdAt: row.created_at.toISOString() };
}
