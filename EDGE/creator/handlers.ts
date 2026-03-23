import type { Request, Response, NextFunction } from "express";
import type { CreatorCampaignPatchBody } from "./campaign-patch-types.js";
import {
  getCreatorCampaignDetail,
  insertCreatorDraft,
  updateCreatorCampaign,
} from "./campaign-mutate-repo.js";
import { listCampaignsByCreatorPlatformUserId } from "./campaigns-repo.js";

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
    res.json({
      campaign: {
        edgeId: row.publicId,
        title: row.title,
        status: row.status,
        edgeType: row.edgeType,
        giftsJson: row.giftsJson,
        followRewardEnabled: row.followRewardEnabled,
        leaderboardGlobalEnabled: row.leaderboardGlobalEnabled,
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
