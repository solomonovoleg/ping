import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type CreatorCampaignSummaryRow = {
  edgeId: string;
  title: string;
  status: string;
  edgeType: string;
  updatedAt: string;
  participantCount: number;
};

export async function listCampaignsByCreatorPlatformUserId(
  platformUserId: string,
): Promise<CreatorCampaignSummaryRow[] | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const uid = platformUserId.trim();
  if (!uid) return [];
  try {
    const { rows } = await pool.query<{
      public_id: string;
      title: string;
      status: string;
      edge_type: string;
      updated_at: Date;
      participant_count: string;
    }>(
      `SELECT c.public_id, c.title, c.status, c.edge_type, c.updated_at,
              COALESCE(p.cnt, 0)::text AS participant_count
       FROM edge_campaigns c
       LEFT JOIN (
         SELECT campaign_public_id, COUNT(*)::int AS cnt
         FROM edge_participants
         GROUP BY campaign_public_id
       ) p ON p.campaign_public_id = c.public_id
       WHERE c.creator_platform_user_id IS NOT NULL
         AND trim(c.creator_platform_user_id) = $1
       ORDER BY c.updated_at DESC
       LIMIT 200`,
      [uid],
    );
    return rows.map((r) => ({
      edgeId: r.public_id,
      title: r.title?.trim() || "Кампания EDGE",
      status: r.status || "draft",
      edgeType: r.edge_type || "character",
      updatedAt: r.updated_at.toISOString(),
      participantCount: Number.parseInt(r.participant_count, 10) || 0,
    }));
  } catch (e) {
    console.error("[edge] listCampaignsByCreatorPlatformUserId", e);
    return null;
  }
}
