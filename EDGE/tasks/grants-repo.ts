import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

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
