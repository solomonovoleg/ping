import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export async function listParticipantUserIdsForCampaign(campaignPublicId: string): Promise<string[] | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ platform_user_id: string }>(
      `SELECT platform_user_id FROM edge_participants WHERE campaign_public_id = $1`,
      [campaignPublicId],
    );
    return rows.map((r) => r.platform_user_id);
  } catch (e) {
    console.error("[edge] listParticipantUserIdsForCampaign", e);
    return null;
  }
}

export async function listWinnerUserIdsForGift(
  campaignPublicId: string,
  giftKey: string,
): Promise<Set<string> | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ platform_user_id: string }>(
      `SELECT platform_user_id FROM edge_prize_winners
       WHERE campaign_public_id = $1 AND gift_key = $2`,
      [campaignPublicId, giftKey],
    );
    return new Set(rows.map((r) => r.platform_user_id));
  } catch (e) {
    console.error("[edge] listWinnerUserIdsForGift", e);
    return null;
  }
}

export async function insertPrizeWinners(
  campaignPublicId: string,
  giftKey: string,
  drawBatchId: string,
  platformUserIds: string[],
): Promise<boolean> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return false;
  if (platformUserIds.length === 0) return true;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const uid of platformUserIds) {
      await client.query(
        `INSERT INTO edge_prize_winners (campaign_public_id, platform_user_id, gift_key, draw_batch_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (campaign_public_id, platform_user_id, gift_key) DO NOTHING`,
        [campaignPublicId, uid, giftKey, drawBatchId],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[edge] insertPrizeWinners", e);
    return false;
  } finally {
    client.release();
  }
}
