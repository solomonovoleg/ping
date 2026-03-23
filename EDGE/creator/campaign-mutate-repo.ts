import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";
import type { CreatorCampaignPatchBody, GiftTemplatePatch } from "./campaign-patch-types.js";
import { buildDefaultCreatorConfig, mergeCreatorConfig } from "./merge-creator-config.js";

const ALLOWED_STATUS = new Set(["draft", "published", "paused", "ended"]);

function normalizeGifts(templates: GiftTemplatePatch[]): { templates: Record<string, unknown>[] } {
  const out: Record<string, unknown>[] = [];
  templates.forEach((g, i) => {
    const title = (g.title || "").trim().slice(0, 200);
    if (!title) return;
    const key = (g.key || "").trim() || `gift_${i + 1}`;
    const row: Record<string, unknown> = { key, title };
    if (g.description?.trim()) row.description = g.description.trim().slice(0, 2000);
    if (typeof g.quantity === "number" && g.quantity > 0) {
      row.quantity = Math.min(9999, Math.floor(g.quantity));
    }
    if (g.imageUrl?.trim()) row.imageUrl = g.imageUrl.trim();
    if (g.videoUrl?.trim()) row.videoUrl = g.videoUrl.trim();
    out.push(row);
  });
  return { templates: out };
}

export async function insertCreatorDraft(
  platformUserId: string,
  title: string,
  edgeType: string,
): Promise<{ publicId: string } | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const uid = platformUserId.trim();
  if (!uid) return null;
  const et = edgeType.trim() === "character" ? "character" : "character";
  const publicId = randomUUID();
  const t = title.trim().slice(0, 200) || "Новая кампания EDGE";
  const config = buildDefaultCreatorConfig();
  try {
    await pool.query(
      `INSERT INTO edge_campaigns (
         public_id, edge_type, creator_platform_user_id, title, status,
         gifts_json, leaderboard_global_enabled, follow_reward_enabled, config_json
       ) VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, true, false, $6::jsonb)`,
      [publicId, et, uid, t, JSON.stringify({ templates: [] }), JSON.stringify(config)],
    );
    return { publicId };
  } catch (e) {
    console.error("[edge] insertCreatorDraft", e);
    return null;
  }
}

export type CreatorCampaignDetailRow = {
  publicId: string;
  title: string;
  status: string;
  edgeType: string;
  giftsJson: unknown;
  followRewardEnabled: boolean;
  leaderboardGlobalEnabled: boolean;
  configJson: unknown;
  updatedAt: string;
};

export async function getCreatorCampaignDetail(
  edgeId: string,
  platformUserId: string,
): Promise<CreatorCampaignDetailRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{
      public_id: string;
      title: string;
      status: string;
      edge_type: string;
      gifts_json: unknown;
      follow_reward_enabled: boolean;
      leaderboard_global_enabled: boolean;
      config_json: unknown;
      updated_at: Date;
    }>(
      `SELECT public_id, title, status, edge_type, gifts_json,
              follow_reward_enabled, leaderboard_global_enabled, config_json, updated_at
       FROM edge_campaigns
       WHERE public_id = $1 AND trim(creator_platform_user_id) = trim($2)
       LIMIT 1`,
      [edgeId.trim(), platformUserId.trim()],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      publicId: r.public_id,
      title: r.title,
      status: r.status,
      edgeType: r.edge_type,
      giftsJson: r.gifts_json,
      followRewardEnabled: r.follow_reward_enabled,
      leaderboardGlobalEnabled: r.leaderboard_global_enabled,
      configJson: r.config_json,
      updatedAt: r.updated_at.toISOString(),
    };
  } catch (e) {
    console.error("[edge] getCreatorCampaignDetail", e);
    return null;
  }
}

export async function updateCreatorCampaign(
  edgeId: string,
  platformUserId: string,
  patch: CreatorCampaignPatchBody,
): Promise<"ok" | "not_found" | "db_unavailable"> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return "db_unavailable";
  const eid = edgeId.trim();
  const uid = platformUserId.trim();
  if (!eid || !uid) return "not_found";

  try {
    const { rows } = await pool.query<{
      title: string;
      status: string;
      gifts_json: unknown;
      config_json: unknown;
      follow_reward_enabled: boolean;
      leaderboard_global_enabled: boolean;
    }>(
      `SELECT title, status, gifts_json, config_json, follow_reward_enabled, leaderboard_global_enabled
       FROM edge_campaigns
       WHERE public_id = $1 AND trim(creator_platform_user_id) = trim($2) LIMIT 1`,
      [eid, uid],
    );
    const row = rows[0];
    if (!row) return "not_found";

    const newTitle =
      patch.title !== undefined ? patch.title.trim().slice(0, 200) || "Кампания EDGE" : row.title;

    let newStatus = row.status;
    if (patch.status !== undefined) {
      const s = String(patch.status).toLowerCase();
      if (ALLOWED_STATUS.has(s)) newStatus = s;
    }

    const newGiftsObj =
      patch.giftsTemplates !== undefined ? normalizeGifts(patch.giftsTemplates) : row.gifts_json;
    const giftsPayload = JSON.stringify(newGiftsObj ?? { templates: [] });

    const newConfig = mergeCreatorConfig(row.config_json, patch);
    const newFollow =
      patch.followRewardEnabled !== undefined ? patch.followRewardEnabled : row.follow_reward_enabled;
    const newLeader =
      patch.leaderboardGlobalEnabled !== undefined
        ? patch.leaderboardGlobalEnabled
        : row.leaderboard_global_enabled;

    const r2 = await pool.query(
      `UPDATE edge_campaigns SET
         title = $3,
         status = $4,
         gifts_json = $5::jsonb,
         config_json = $6::jsonb,
         follow_reward_enabled = $7,
         leaderboard_global_enabled = $8,
         updated_at = now()
       WHERE public_id = $1 AND trim(creator_platform_user_id) = trim($2)`,
      [eid, uid, newTitle, newStatus, giftsPayload, JSON.stringify(newConfig), newFollow, newLeader],
    );
    if (r2.rowCount === 0) return "not_found";
    return "ok";
  } catch (e) {
    console.error("[edge] updateCreatorCampaign", e);
    return "db_unavailable";
  }
}
