import type { Request, Response, NextFunction } from "express";
import { runPrizeDraw } from "./service.js";

export async function postDraw(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = (req.body ?? {}) as { edgeId?: unknown; giftKey?: unknown; count?: unknown };
    const edgeId = String(body.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const giftKey = body.giftKey !== undefined && body.giftKey !== null ? String(body.giftKey) : undefined;
    const count = body.count !== undefined && body.count !== null ? Number(body.count) : undefined;

    const result = await runPrizeDraw({ edgeId, giftKey, count });
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
