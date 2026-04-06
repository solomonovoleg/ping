import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type LeaderboardRepoRow = {
  platform_user_id: string;
  xp: number;
  level: number;
  care_streak_days: number;
};

export async function countCampaignParticipants(campaignPublicId: string): Promise<number | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_participants WHERE campaign_public_id = $1`,
      [campaignPublicId],
    );
    const n = Number(rows[0]?.c ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    console.error("[edge] countCampaignParticipants", e);
    return null;
  }
}

export async function listCampaignLeaderboard(
  campaignPublicId: string,
  limit: number,
  kind: "primary" | "secondary" = "primary",
): Promise<LeaderboardRepoRow[] | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const scoreCol = kind === "secondary" ? "c.secondary_xp" : "c.primary_xp";
    const levelExpr = `FLOOR(GREATEST(0, ${scoreCol}) / 100)::int`;
    const { rows } = await pool.query<LeaderboardRepoRow>(
      `SELECT p.platform_user_id, ${scoreCol} AS xp, ${levelExpr} AS level, c.care_streak_days
       FROM edge_participants p
       INNER JOIN edge_character_states c ON c.participant_id = p.id
       WHERE p.campaign_public_id = $1
       ORDER BY ${scoreCol} DESC, ${levelExpr} DESC, p.joined_at ASC
       LIMIT $2`,
      [campaignPublicId, limit],
    );
    return rows;
  } catch (e) {
    console.error("[edge] listCampaignLeaderboard", e);
    return null;
  }
}

export async function getParticipantRankInCampaign(
  campaignPublicId: string,
  platformUserId: string,
  kind: "primary" | "secondary" = "primary",
): Promise<number | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const scoreCol = kind === "secondary" ? "c.secondary_xp" : "c.primary_xp";
    const { rows } = await pool.query<{ rank: string }>(
      `WITH ranked AS (
         SELECT p.platform_user_id,
                ROW_NUMBER() OVER (ORDER BY ${scoreCol} DESC, c.level DESC, p.joined_at ASC) AS rank
         FROM edge_participants p
         INNER JOIN edge_character_states c ON c.participant_id = p.id
         WHERE p.campaign_public_id = $1
       )
       SELECT rank::text FROM ranked WHERE platform_user_id = $2
       LIMIT 1`,
      [campaignPublicId, platformUserId],
    );
    const n = Number(rows[0]?.rank ?? NaN);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    console.error("[edge] getParticipantRankInCampaign", e);
    return null;
  }
}
