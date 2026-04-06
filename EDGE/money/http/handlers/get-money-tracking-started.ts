import type { Request, Response } from "express";
import { isMoneyTrackingStartedForUser } from "../../participant-money-tracking.js";

export async function getMoneyTrackingStarted(req: Request, res: Response): Promise<void> {
  const edgeId = String(req.query.edgeId ?? "").trim();
  const platformUserId = String(req.query.platformUserId ?? "").trim();
  if (!edgeId || !platformUserId) {
    res.status(400).json({ error: "edgeId_and_platformUserId_required" });
    return;
  }
  const started = await isMoneyTrackingStartedForUser(edgeId, platformUserId);
  if (started === null) {
    res.status(503).json({ error: "edge_unavailable" });
    return;
  }
  res.json({ started });
}
