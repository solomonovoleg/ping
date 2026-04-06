import type { Pool } from "pg";
import { getEdgePool } from "../../db/pool.js";

/** Опубликованные EDGE MONEY кампании автора (дальше фильтр по `follow_creator` в конфиге). */
export async function listPublishedMoneyCampaignIdsForCreator(creatorPlatformUserId: string): Promise<string[]> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return [];
  const id = creatorPlatformUserId.trim();
  if (!id) return [];
  try {
    const { rows } = await pool.query<{ public_id: string }>(
      `SELECT public_id FROM edge_campaigns
       WHERE lower(trim(status)) = 'published'
         AND lower(trim(coalesce(edge_type, ''))) = 'money'
         AND creator_platform_user_id IS NOT NULL
         AND trim(creator_platform_user_id) = trim($1)`,
      [id],
    );
    return rows.map((r) => String(r.public_id || "").trim()).filter(Boolean);
  } catch (e) {
    console.error("[edge] listPublishedMoneyCampaignIdsForCreator", e);
    return [];
  }
}
