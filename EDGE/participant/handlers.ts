import type { Request, Response, NextFunction } from "express";
import { parseInteractKind } from "./character-rules.js";
import {
  getCampaignLeaderboard,
  getParticipantState,
  postParticipantFeed,
  postParticipantInteract,
} from "./service.js";

export async function getState(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    const userId = req.edgePlatformUserId ?? "";
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const payload = await getParticipantState(edgeId, userId);
    if (!payload) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    const userId = req.edgePlatformUserId ?? "";
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const limit = Number(req.query.limit ?? 30);
    const payload = await getCampaignLeaderboard(edgeId, userId, limit);
    if (!payload) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function postFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    const userId = req.edgePlatformUserId ?? "";
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const payload = await postParticipantFeed(edgeId, userId);
    if (!payload) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    if (payload === "locked") {
      res.status(403).json({ error: "edge_campaign_locked" });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function postInteract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    const userId = req.edgePlatformUserId ?? "";
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const kind = parseInteractKind((req.body as { kind?: unknown })?.kind);
    if (!kind) {
      res.status(400).json({ error: "invalid_interact_kind" });
      return;
    }
    const out = await postParticipantInteract(edgeId, userId, kind);
    if (!out) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    if (out === "locked") {
      res.status(403).json({ error: "edge_campaign_locked" });
      return;
    }
    if (!out.ok) {
      res.status(429).json({
        error: "interact_cooldown",
        kind: out.kind,
        nextAvailableAt: out.nextAvailableAt,
      });
      return;
    }
    res.json(out.state);
  } catch (e) {
    next(e);
  }
}
