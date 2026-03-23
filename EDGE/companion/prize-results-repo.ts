import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type PrizeWinnerRow = {
  platform_user_id: string;
  gift_key: string;
  created_at: Date;
};

/**
 * Последний по времени draw_batch_id и все победители этой итерации.
 */
export async function fetchLatestPrizeDrawWinners(
  campaignPublicId: string,
): Promise<{ drawBatchId: string; drawnAt: string; rows: PrizeWinnerRow[] } | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const cid = campaignPublicId.trim();
  if (!cid) return null;
  try {
    const batch = await pool.query<{ draw_batch_id: string }>(
      `SELECT draw_batch_id FROM edge_prize_winners
       WHERE campaign_public_id = $1
       GROUP BY draw_batch_id
       ORDER BY MAX(created_at) DESC
       LIMIT 1`,
      [cid],
    );
    const bid = batch.rows[0]?.draw_batch_id;
    if (!bid) return null;

    const { rows } = await pool.query<PrizeWinnerRow>(
      `SELECT platform_user_id, gift_key, created_at
       FROM edge_prize_winners
       WHERE campaign_public_id = $1 AND draw_batch_id = $2::uuid
       ORDER BY created_at ASC`,
      [cid, bid],
    );
    if (rows.length === 0) return null;
    const drawnAt = rows[0]!.created_at.toISOString();
    return { drawBatchId: bid, drawnAt, rows };
  } catch (e) {
    console.error("[edge] fetchLatestPrizeDrawWinners", e);
    return null;
  }
}
