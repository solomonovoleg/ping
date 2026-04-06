import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

function utcDayBounds(now: Date): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Сумма `xp_awarded` за текущие календарные сутки UTC. */
export async function sumXpForTaskKeyUtcDay(
  campaignPublicId: string,
  platformUserId: string,
  taskKey: string,
  now: Date,
): Promise<number | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const c = campaignPublicId.trim();
  const u = platformUserId.trim();
  const k = taskKey.trim();
  if (!c || !u || !k) return null;
  const { start, end } = utcDayBounds(now);
  try {
    const { rows } = await pool.query<{ s: number }>(
      `SELECT COALESCE(SUM(xp_awarded), 0)::int AS s
       FROM edge_task_grants
       WHERE campaign_public_id = $1 AND platform_user_id = $2 AND task_key = $3
         AND created_at >= $4 AND created_at < $5`,
      [c, u, k, start.toISOString(), end.toISOString()],
    );
    const n = rows[0]?.s;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  } catch (e) {
    console.error("[edge] sumXpForTaskKeyUtcDay", e);
    return null;
  }
}
