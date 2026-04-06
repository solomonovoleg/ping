import type { Request, Response, NextFunction } from "express";
import type { CreatorCampaignPatchBody } from "./campaign-patch-types.js";
import type { EdgeCampaignRow } from "../companion/repo.js";
import { effectiveLeaderboardXpFrozen } from "../participant/leaderboard-draw-freeze.js";
import {
  getCreatorCampaignDetail,
  insertCreatorDraft,
  updateCreatorCampaign,
} from "./campaign-mutate-repo.js";
import { fetchCampaignLifeStats } from "./life-stats-repo.js";
import { listCampaignsByCreatorPlatformUserId } from "./campaigns-repo.js";
import { parsePrizeDrawRulesOverrideFromBody, runPrizeDraw } from "../campaign/service.js";

export async function getMyCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.edgePlatformUserId ?? "";
    const rows = await listCampaignsByCreatorPlatformUserId(userId);
    if (rows === null) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.json({ campaigns: rows });
  } catch (e) {
    next(e);
  }
}

export async function getCreatorCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.edgePlatformUserId ?? "";
    const edgeId = String(req.params.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edge_id_required" });
      return;
    }
    const row = await getCreatorCampaignDetail(edgeId, userId);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const campaignRow: EdgeCampaignRow = {
      public_id: row.publicId,
      edge_type: row.edgeType,
      title: row.title,
      status: row.status,
      gifts_json: row.giftsJson,
      leaderboard_global_enabled: row.leaderboardGlobalEnabled,
      leaderboard_primary_enabled: row.leaderboardPrimaryEnabled,
      leaderboard_secondary_enabled: row.leaderboardSecondaryEnabled,
      primary_leaderboard_frozen_at: row.primaryLeaderboardFrozenAt,
      secondary_leaderboard_frozen_at: row.secondaryLeaderboardFrozenAt,
      follow_reward_enabled: row.followRewardEnabled,
      creator_platform_user_id: null,
      config_json: row.configJson,
    };
    const now = new Date();
    res.json({
      campaign: {
        edgeId: row.publicId,
        title: row.title,
        status: row.status,
        edgeType: row.edgeType,
        giftsJson: row.giftsJson,
        followRewardEnabled: row.followRewardEnabled,
        leaderboardGlobalEnabled: row.leaderboardGlobalEnabled,
        leaderboardPrimaryEnabled: row.leaderboardPrimaryEnabled,
        leaderboardSecondaryEnabled: row.leaderboardSecondaryEnabled,
        leaderboardPrimaryFrozenEffective: effectiveLeaderboardXpFrozen(campaignRow, "primary", now),
        leaderboardSecondaryFrozenEffective: effectiveLeaderboardXpFrozen(campaignRow, "secondary", now),
        configJson: row.configJson,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function postCreateCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.edgePlatformUserId ?? "";
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const title = typeof body.title === "string" ? body.title : "Новая кампания EDGE";
    const edgeType = typeof body.edgeType === "string" ? body.edgeType : "character";
    const created = await insertCreatorDraft(userId, title, edgeType);
    if (!created) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    const t = title.trim().slice(0, 200) || "Новая кампания EDGE";
    res.status(201).json({ edgeId: created.publicId, title: t });
  } catch (e) {
    next(e);
  }
}

export async function getCampaignLifeStatsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.edgePlatformUserId ?? "";
    const edgeId = String(req.params.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edge_id_required" });
      return;
    }
    const row = await getCreatorCampaignDetail(edgeId, userId);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const stats = await fetchCampaignLifeStats(edgeId);
    if (!stats) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.json({ stats });
  } catch (e) {
    next(e);
  }
}

export async function patchCreatorCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.edgePlatformUserId ?? "";
    const edgeId = String(req.params.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edge_id_required" });
      return;
    }
    const raw = req.body;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const patch = raw as CreatorCampaignPatchBody;
    const result = await updateCreatorCampaign(edgeId, userId, patch);
    if (result === "db_unavailable") {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    if (result === "not_found") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

/**
 * Розыгрыш приза создателем: те же правила, что POST /v1/campaign/draw, плюс опциональное переопределение пула/метода/рейтинга в теле.
 * ЛС на платформе — отдельным вызовом после ответа.
 */
export async function postCreatorPrizeDraw(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.edgePlatformUserId ?? "";
    const edgeId = String(req.params.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edge_id_required" });
      return;
    }
    const row = await getCreatorCampaignDetail(edgeId, userId);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const raw = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const body = raw as Record<string, unknown>;
    const giftKey = body.giftKey !== undefined && body.giftKey !== null ? String(body.giftKey) : undefined;
    const count = body.count !== undefined && body.count !== null ? Number(body.count) : undefined;
    const rulesOverride = parsePrizeDrawRulesOverrideFromBody(body);

    const result = await runPrizeDraw({ edgeId, giftKey, count, rulesOverride });
    if (!result.ok) {
      if (result.error === "campaign_not_found") {
        res.status(404).json({ error: "campaign_not_found" });
        return;
      }
      if (result.error === "no_eligible_participants") {
        res.status(409).json({ error: "no_eligible_participants" });
        return;
      }
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.status(201).json(result.payload);
  } catch (e) {
    next(e);
  }
}
