import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

/** `public_id` кампаний с наградой за подписку на создателя (опубликованные). */
export async function listFollowRewardCampaignPublicIds(creatorPlatformUserId: string): Promise<string[]> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return [];
  const id = creatorPlatformUserId.trim();
  if (!id) return [];
  try {
    const { rows } = await pool.query<{ public_id: string }>(
      `SELECT public_id FROM edge_campaigns
       WHERE follow_reward_enabled = true
         AND status = 'published'
         AND creator_platform_user_id IS NOT NULL
         AND trim(creator_platform_user_id) = $1
         AND lower(trim(coalesce(edge_type, ''))) <> 'money'`,
      [id],
    );
    return rows.map((r) => r.public_id);
  } catch (e) {
    console.error("[edge] listFollowRewardCampaignPublicIds", e);
    return [];
  }
}
