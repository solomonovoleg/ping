import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { computeInteractLocked } from "../companion/interact-lock.js";
import { ensureParticipant } from "../participant/participant-repo.js";

/**
 * Участник MONEY с явным стартом отслеживания заданий (кнопка «Выполнить» на вкладке заданий).
 */
export async function getMoneyParticipantIdIfTrackingActive(
  edgeId: string,
  platformUserId: string,
): Promise<string | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return null;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM edge_participants
       WHERE campaign_public_id = $1 AND trim(platform_user_id) = trim($2)
         AND money_tracking_started_at IS NOT NULL`,
      [e, u],
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[edge/money] getMoneyParticipantIdIfTrackingActive", err);
    return null;
  }
}

export type StartMoneyTrackingResult =
  | { ok: true }
  | { ok: false; error: string; httpStatus: number };

export async function startMoneyTrackingForUser(
  edgeId: string,
  platformUserId: string,
): Promise<StartMoneyTrackingResult> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return { ok: false, error: "edge_db_unavailable", httpStatus: 503 };
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return { ok: false, error: "edgeId_or_user_required", httpStatus: 400 };

  const campaign = await findCampaignByPublicId(e);
  if (!campaign) return { ok: false, error: "not_found", httpStatus: 404 };
  if ((campaign.edge_type || "").trim() !== "money") {
    return { ok: false, error: "edge_type_not_money", httpStatus: 409 };
  }
  if (String(campaign.status || "").toLowerCase() !== "published") {
    return { ok: false, error: "campaign_not_published", httpStatus: 409 };
  }
  if (computeInteractLocked(campaign)) {
    return { ok: false, error: "interact_locked", httpStatus: 409 };
  }

  const p = await ensureParticipant(e, u);
  if (!p) return { ok: false, error: "participant_create_failed", httpStatus: 503 };

  try {
    await pool.query(
      `UPDATE edge_participants
       SET money_tracking_started_at = COALESCE(money_tracking_started_at, NOW())
       WHERE id = $1`,
      [p.id],
    );
    return { ok: true };
  } catch (err) {
    console.error("[edge/money] startMoneyTrackingForUser", err);
    return { ok: false, error: "update_failed", httpStatus: 503 };
  }
}

export async function isMoneyTrackingStartedForUser(
  edgeId: string,
  platformUserId: string,
): Promise<boolean | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return false;
  try {
    const { rows } = await pool.query<{ s: boolean }>(
      `SELECT (money_tracking_started_at IS NOT NULL) AS s
       FROM edge_participants
       WHERE campaign_public_id = $1 AND trim(platform_user_id) = trim($2)`,
      [e, u],
    );
    if (!rows[0]) return false;
    return Boolean(rows[0].s);
  } catch (err) {
    console.error("[edge/money] isMoneyTrackingStartedForUser", err);
    return null;
  }
}
