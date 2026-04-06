import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type FollowDmPayload = {
  text: string;
  mediaUrl: string | null;
};

function followDmFromConfigJson(configJson: unknown): FollowDmPayload | null {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const fr = root.followRewardDm;
  const o = fr && typeof fr === "object" && !Array.isArray(fr) ? (fr as Record<string, unknown>) : {};
  if (o.enabled !== true) return null;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const mediaUrl = typeof o.mediaUrl === "string" && o.mediaUrl.trim() ? o.mediaUrl.trim() : null;
  if (!text && !mediaUrl) return null;
  return { text, mediaUrl };
}

/**
 * Авто-ЛС только из кампаний, которые реально начислили награду за этот follow
 * (`followRewardDm.enabled` + текст или медиа). Иначе текст из старой кампании мог
 * уходить при включённой только награде XP в другой — выглядело как «рандом».
 */
export async function pickFollowDmPayloadForAwardedCampaigns(
  creatorPlatformUserId: string,
  awardedCampaignPublicIds: string[],
): Promise<FollowDmPayload | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const uid = creatorPlatformUserId.trim();
  const ids = [...new Set(awardedCampaignPublicIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!uid || ids.length === 0) return null;
  try {
    const { rows } = await pool.query<{ config_json: unknown }>(
      `SELECT config_json FROM edge_campaigns
       WHERE public_id = ANY($1::text[])
         AND trim(creator_platform_user_id) = $2
         AND status = 'published'
         AND follow_reward_enabled = true
       ORDER BY updated_at DESC`,
      [ids, uid],
    );
    for (const r of rows) {
      const payload = followDmFromConfigJson(r.config_json);
      if (payload) return payload;
    }
    return null;
  } catch (e) {
    console.error("[edge] pickFollowDmPayloadForAwardedCampaigns", e);
    return null;
  }
}
