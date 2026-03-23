import type { Request, Response, NextFunction } from "express";
import { replaceCampaignCompanionJson } from "./companion-config-update.js";

export async function postCompanionConfig(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = (req.body ?? {}) as { edgeId?: unknown; companion?: unknown };
    const edgeId = String(body.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const c = body.companion;
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      res.status(400).json({ error: "companion_object_required" });
      return;
    }
    const ok = await replaceCampaignCompanionJson(edgeId, c as Record<string, unknown>);
    if (!ok) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
