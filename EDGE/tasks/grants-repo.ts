import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type TaskGrantRow = {
  task_key: string;
  ref_key: string;
  xp_awarded: number;
  created_at: Date;
};

const TASK_KEY_RE = /^[a-zA-Z0-9_]{1,64}$/;

function assertTaskKey(taskKey: string): boolean {
  return TASK_KEY_RE.test(taskKey.trim());
}

/** @returns true если строка вставлена (первое начисление по dedupe). */
export async function tryInsertTaskGrant(
  campaignPublicId: string,
  platformUserId: string,
  taskKey: string,
  refKey: string,
  xpAwarded: number,
): Promise<boolean | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const k = taskKey.trim();
  if (!assertTaskKey(k)) {
    console.error("[edge] tryInsertTaskGrant invalid task_key");
    return null;
  }
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO edge_task_grants (campaign_public_id, platform_user_id, task_key, ref_key, xp_awarded)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (campaign_public_id, platform_user_id, task_key, ref_key) DO NOTHING
       RETURNING id`,
      [campaignPublicId, platformUserId, k, refKey, xpAwarded],
    );
    return rows.length > 0;
  } catch (e) {
    console.error("[edge] tryInsertTaskGrant", e);
    return null;
  }
}

/** Все начисления участника по кампании (для UI прогресса и «уже получено»). */
/** Сумма `xp_awarded` по одному ключу задания (например `money_invite`). */
export async function sumXpForTaskKey(
  campaignPublicId: string,
  platformUserId: string,
  taskKey: string,
): Promise<number | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const k = taskKey.trim();
  if (!assertTaskKey(k)) return null;
  try {
    const { rows } = await pool.query<{ s: number }>(
      `SELECT COALESCE(SUM(xp_awarded), 0)::int AS s
       FROM edge_task_grants
       WHERE campaign_public_id = $1 AND platform_user_id = $2 AND task_key = $3`,
      [campaignPublicId, platformUserId, k],
    );
    const n = rows[0]?.s;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  } catch (e) {
    console.error("[edge] sumXpForTaskKey", e);
    return null;
  }
}

/** Строки грантов только этого участника в этой кампании (без смешивания с другими людьми). */
/** Есть ли хотя бы один грант по ключу (например `money_follow_creator`). */
export async function hasTaskGrantForKey(
  campaignPublicId: string,
  platformUserId: string,
  taskKey: string,
): Promise<boolean | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const k = taskKey.trim();
  if (!assertTaskKey(k)) return null;
  try {
    const { rows } = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM edge_task_grants
         WHERE campaign_public_id = $1 AND platform_user_id = $2 AND task_key = $3
       ) AS ok`,
      [campaignPublicId, platformUserId, k],
    );
    return Boolean(rows[0]?.ok);
  } catch (e) {
    console.error("[edge] hasTaskGrantForKey", e);
    return null;
  }
}

export async function listTaskGrantsForParticipant(
  campaignPublicId: string,
  platformUserId: string,
): Promise<TaskGrantRow[] | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<TaskGrantRow>(
      `SELECT task_key, ref_key, xp_awarded, created_at
       FROM edge_task_grants
       WHERE campaign_public_id = $1 AND platform_user_id = $2
       ORDER BY created_at ASC`,
      [campaignPublicId, platformUserId],
    );
    return rows;
  } catch (e) {
    console.error("[edge] listTaskGrantsForParticipant", e);
    return null;
  }
}
