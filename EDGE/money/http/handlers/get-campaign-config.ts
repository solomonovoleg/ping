import type { Request, Response, NextFunction } from "express";
import { findCampaignByPublicId } from "../../../companion/repo.js";
import { buildMoneyCampaignPublicPayload } from "../../service/money-public-payload.js";

export async function getMoneyCampaignConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const row = await findCampaignByPublicId(edgeId);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const payload = buildMoneyCampaignPublicPayload(row);
    if (!payload) {
      res.status(409).json({ error: "edge_type_mismatch", expected: "money" });
      return;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
}
