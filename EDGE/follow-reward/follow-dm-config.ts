import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type FollowDmPayload = {
  text: string;
  mediaUrl: string | null;
};

/**
 * Первое подходящее авто-ЛС среди кампаний создателя (`followRewardDm.enabled` + текст или медиа).
 */
export async function pickFollowDmPayloadForCreator(
  creatorPlatformUserId: string,
): Promise<FollowDmPayload | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const uid = creatorPlatformUserId.trim();
  if (!uid) return null;
  try {
    const { rows } = await pool.query<{ config_json: unknown }>(
      `SELECT config_json FROM edge_campaigns
       WHERE trim(creator_platform_user_id) = $1
         AND status = 'published'
         AND follow_reward_enabled = true
       ORDER BY updated_at DESC
       LIMIT 50`,
      [uid],
    );
    for (const r of rows) {
      const root =
        r.config_json && typeof r.config_json === "object" && !Array.isArray(r.config_json)
          ? (r.config_json as Record<string, unknown>)
          : {};
      const fr = root.followRewardDm;
      const o = fr && typeof fr === "object" && !Array.isArray(fr) ? (fr as Record<string, unknown>) : {};
      if (o.enabled !== true) continue;
      const text = typeof o.text === "string" ? o.text.trim() : "";
      const mediaUrl = typeof o.mediaUrl === "string" && o.mediaUrl.trim() ? o.mediaUrl.trim() : null;
      if (!text && !mediaUrl) continue;
      return { text, mediaUrl };
    }
    return null;
  } catch (e) {
    console.error("[edge] pickFollowDmPayloadForCreator", e);
    return null;
  }
}
