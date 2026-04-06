import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";
import type { ParticipantRow } from "./db-types.js";

export async function getParticipantEdgeMeta(
  participantId: string,
): Promise<{ campaignPublicId: string; joinedAt: Date } | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ campaign_public_id: string; joined_at: Date }>(
      `SELECT campaign_public_id, joined_at FROM edge_participants WHERE id = $1`,
      [participantId],
    );
    const r = rows[0];
    if (!r) return null;
    return { campaignPublicId: r.campaign_public_id, joinedAt: new Date(r.joined_at) };
  } catch (e) {
    console.error("[edge] getParticipantEdgeMeta", e);
    return null;
  }
}

export async function ensureParticipant(
  campaignPublicId: string,
  platformUserId: string,
): Promise<ParticipantRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const ins = await pool.query<ParticipantRow>(
      `INSERT INTO edge_participants (campaign_public_id, platform_user_id)
       VALUES ($1, $2)
       ON CONFLICT (campaign_public_id, platform_user_id) DO UPDATE
         SET platform_user_id = EXCLUDED.platform_user_id
       RETURNING id, campaign_public_id, platform_user_id, joined_at, money_tracking_started_at`,
      [campaignPublicId, platformUserId],
    );
    return ins.rows[0] ?? null;
  } catch (e) {
    console.error("[edge] ensureParticipant", e);
    return null;
  }
}
