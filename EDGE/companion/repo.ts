import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type EdgeCampaignRow = {
  public_id: string;
  edge_type: string;
  title: string;
  status: string;
  gifts_json: unknown;
  leaderboard_global_enabled: boolean;
  leaderboard_primary_enabled: boolean;
  leaderboard_secondary_enabled: boolean;
  primary_leaderboard_frozen_at: Date | null;
  secondary_leaderboard_frozen_at: Date | null;
  follow_reward_enabled: boolean;
  creator_platform_user_id: string | null;
  config_json: unknown;
};

/** Создаёт строку кампании при первом обращении по `edge_id` из поста (без ручного сида). */
export async function ensureEdgeCampaign(publicId: string): Promise<void> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO edge_campaigns (
         public_id, edge_type, title, status, gifts_json,
         leaderboard_global_enabled, follow_reward_enabled, config_json
       )
       VALUES ($1, 'character', 'Кампания EDGE', 'published', '[]'::jsonb, true, false, '{}'::jsonb)
       ON CONFLICT (public_id) DO NOTHING`,
      [publicId],
    );
  } catch (e) {
    console.error("[edge] ensureEdgeCampaign", e);
  }
}

export async function findCampaignByPublicId(publicId: string): Promise<EdgeCampaignRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<EdgeCampaignRow>(
      `SELECT public_id, edge_type, title, status, gifts_json,
              leaderboard_global_enabled, leaderboard_primary_enabled, leaderboard_secondary_enabled,
              primary_leaderboard_frozen_at, secondary_leaderboard_frozen_at, follow_reward_enabled,
              creator_platform_user_id, config_json
       FROM edge_campaigns
       WHERE public_id = $1
       LIMIT 1`,
      [publicId],
    );
    return rows[0] ?? null;
  } catch (e) {
    console.error("[edge] findCampaignByPublicId", e);
    return null;
  }
}
