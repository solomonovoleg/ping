import { getPool } from "../db";

export type MsgRow = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  content: string;
  created_at: Date;
};

export async function getCursor(userId: string, chatId: string): Promise<Date | null> {
  const p = getPool();
  const r = await p.query<{ last_created_at: Date | null }>(
    `SELECT last_created_at FROM ai_search_chat_cursors WHERE user_id = $1 AND chat_id = $2`,
    [userId, chatId]
  );
  const t = r.rows[0]?.last_created_at;
  return t ? new Date(t) : null;
}

export async function setCursor(userId: string, chatId: string, at: Date): Promise<void> {
  const p = getPool();
  await p.query(
    `INSERT INTO ai_search_chat_cursors (user_id, chat_id, last_created_at) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, chat_id) DO UPDATE SET
       last_created_at = GREATEST(
         COALESCE(ai_search_chat_cursors.last_created_at, EXCLUDED.last_created_at),
         EXCLUDED.last_created_at
       )`,
    [userId, chatId, at]
  );
}

/** Новые сообщения после курсора; если курсора нет — последние `limit` текстовых. */
export async function fetchTextBatch(
  userId: string,
  chatId: string,
  after: Date | null,
  limit: number
): Promise<MsgRow[]> {
  const p = getPool();
  const lim = Math.min(Math.max(limit, 1), 45);
  if (after) {
    const r = await p.query<MsgRow>(
      `SELECT m.id, m.chat_id, m.sender_id, m.content, m.created_at
       FROM messages m
       INNER JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $1
       WHERE m.chat_id = $2 AND m.type = 'text' AND length(trim(m.content)) > 0
         AND m.created_at > $3
       ORDER BY m.created_at ASC
       LIMIT $4`,
      [userId, chatId, after, lim]
    );
    return r.rows;
  }
  const r = await p.query<MsgRow>(
    `SELECT m.id, m.chat_id, m.sender_id, m.content, m.created_at
     FROM messages m
     INNER JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $1
     WHERE m.chat_id = $2 AND m.type = 'text' AND length(trim(m.content)) > 0
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [userId, chatId, lim]
  );
  return r.rows.reverse();
}

export async function getDmPeerUserId(chatId: string, viewerId: string): Promise<string | null> {
  const p = getPool();
  const r = await p.query<{ user_id: string }>(
    `SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id <> $2 LIMIT 1`,
    [chatId, viewerId]
  );
  return r.rows[0]?.user_id ?? null;
}

export async function upsertTag(input: {
  userId: string;
  chatId: string;
  tagKey: string;
  tagLabel: string;
  peerUserId: string | null;
  snippet: string | null;
}): Promise<void> {
  const p = getPool();
  const key = input.tagKey.slice(0, 64);
  const label = input.tagLabel.slice(0, 200);
  const sn = input.snippet ? input.snippet.slice(0, 400) : null;
  await p.query(
    `INSERT INTO ai_search_dialogue_tags
       (user_id, chat_id, tag_key, tag_label, peer_user_id, hit_count, snippet, first_at, last_at)
     VALUES ($1, $2, $3, $4, $5, 1, $6, now(), now())
     ON CONFLICT (user_id, chat_id, tag_key) DO UPDATE SET
       hit_count = ai_search_dialogue_tags.hit_count + 1,
       last_at = now(),
       tag_label = EXCLUDED.tag_label,
       snippet = COALESCE(EXCLUDED.snippet, ai_search_dialogue_tags.snippet)`,
    [input.userId, input.chatId, key, label, input.peerUserId, sn]
  );
}

export async function upsertInterest(input: {
  userId: string;
  kind: "commercial" | "behavioral";
  labelKey: string;
  labelDisplay: string;
  score: number;
}): Promise<void> {
  const p = getPool();
  const sc = Math.min(100, Math.max(0, Math.round(input.score)));
  await p.query(
    `INSERT INTO ai_search_interests
       (user_id, kind, label_key, label_display, score, evidence_count, last_at)
     VALUES ($1, $2, $3, $4, $5, 1, now())
     ON CONFLICT (user_id, kind, label_key) DO UPDATE SET
       evidence_count = ai_search_interests.evidence_count + 1,
       last_at = now(),
       score = GREATEST(ai_search_interests.score, EXCLUDED.score),
       label_display = EXCLUDED.label_display`,
    [input.userId, input.kind, input.labelKey.slice(0, 64), input.labelDisplay.slice(0, 240), sc]
  );
}

export async function searchIndexed(userId: string, q: string, lim: number) {
  const p = getPool();
  const raw = q.trim().slice(0, 120).replace(/[%_\\]/g, " ");
  const like = `%${raw}%`;
  const tags = await p.query(
    `SELECT tag_label, tag_key, chat_id, hit_count, last_at, snippet
     FROM ai_search_dialogue_tags
     WHERE user_id = $1 AND (tag_label ILIKE $2 OR tag_key ILIKE $2)
     ORDER BY last_at DESC
     LIMIT $3`,
    [userId, like, lim]
  );
  const intr = await p.query(
    `SELECT kind, label_display, label_key, score, evidence_count, last_at
     FROM ai_search_interests
     WHERE user_id = $1 AND (label_display ILIKE $2 OR label_key ILIKE $2)
     ORDER BY score DESC, last_at DESC
     LIMIT $3`,
    [userId, like, lim]
  );
  return { tags: tags.rows, interests: intr.rows };
}

export async function listTopInterests(
  userId: string,
  kind: "commercial" | "behavioral",
  limit: number,
) {
  const p = getPool();
  const lim = Math.min(Math.max(limit, 1), 50);
  const r = await p.query(
    `SELECT kind, label_display, label_key, score, evidence_count, last_at
     FROM ai_search_interests
     WHERE user_id = $1 AND kind = $2
     ORDER BY score DESC, last_at DESC
     LIMIT $3`,
    [userId, kind, lim],
  );
  return r.rows;
}
