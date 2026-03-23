import type { Request, Response, NextFunction } from "express";
import { getCampaignConfigByEdgeId } from "./service.js";

export async function getCampaignConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const payload = await getCampaignConfigByEdgeId(edgeId);
    if (!payload) {
      res.status(503).json({ error: "edge_database_unavailable" });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
}
