import { getPool } from "../db";

export type HotSignalRow = {
  signal_key: string;
  label_display: string;
  snippet: string | null;
  source_chat_id: string | null;
  score: number;
  last_at: Date;
  expires_at: Date;
};

function hotTtlHours(): number {
  const n = Number(process.env.AI_SEARCH_HOT_TTL_HOURS);
  if (Number.isFinite(n) && n > 0 && n <= 168) return Math.floor(n);
  return 48;
}

const HOT_L1_TTL_MS = Math.min(
  Math.max(Number(process.env.AI_SEARCH_HOT_L1_MS) || 45_000, 5_000),
  300_000,
);

const l1 = new Map<string, { at: number; rows: HotSignalRow[] }>();

export function invalidateHotSignalsL1(userId: string): void {
  l1.delete(userId);
}

export async function upsertHotSignal(input: {
  userId: string;
  signalKey: string;
  labelDisplay: string;
  snippet: string | null;
  sourceChatId: string | null;
  score: number;
}): Promise<void> {
  const p = getPool();
  const key = input.signalKey.slice(0, 64);
  const label = input.labelDisplay.slice(0, 240);
  const sn = input.snippet ? input.snippet.slice(0, 400) : null;
  const sc = Math.min(100, Math.max(0, Math.round(input.score)));
  const hours = hotTtlHours();
  await p.query(
    `INSERT INTO ai_search_hot_signals
       (user_id, signal_key, label_display, snippet, source_chat_id, score, last_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now() + ($7::double precision * interval '1 hour'))
     ON CONFLICT (user_id, signal_key) DO UPDATE SET
       last_at = now(),
       expires_at = now() + ($7::double precision * interval '1 hour'),
       score = GREATEST(ai_search_hot_signals.score, EXCLUDED.score),
       label_display = EXCLUDED.label_display,
       snippet = COALESCE(EXCLUDED.snippet, ai_search_hot_signals.snippet),
       source_chat_id = COALESCE(EXCLUDED.source_chat_id, ai_search_hot_signals.source_chat_id)`,
    [input.userId, key, label, sn, input.sourceChatId, sc, hours],
  );
  invalidateHotSignalsL1(input.userId);
}

async function loadActiveHotFromDb(userId: string, limit: number): Promise<HotSignalRow[]> {
  const p = getPool();
  const lim = Math.min(Math.max(limit, 1), 40);
  const q = await p.query<HotSignalRow>(
    `SELECT signal_key, label_display, snippet, source_chat_id, score, last_at, expires_at
     FROM ai_search_hot_signals
     WHERE user_id = $1 AND expires_at > now()
     ORDER BY score DESC, last_at DESC
     LIMIT $2`,
    [userId, lim],
  );
  return q.rows;
}

/** Активные «сейчас можно показать рекламу» темы: сначала L1, иначе БД. */
export async function getActiveHotSignals(userId: string, limit = 20): Promise<HotSignalRow[]> {
  const now = Date.now();
  const hit = l1.get(userId);
  if (hit && now - hit.at < HOT_L1_TTL_MS) {
    return hit.rows.slice(0, limit);
  }
  const rows = await loadActiveHotFromDb(userId, limit);
  l1.set(userId, { at: now, rows });
  return rows;
}
