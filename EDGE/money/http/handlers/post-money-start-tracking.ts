import type { Request, Response } from "express";
import { startMoneyTrackingForUser } from "../../participant-money-tracking.js";

export async function postMoneyStartTracking(req: Request, res: Response): Promise<void> {
  const userId = req.edgePlatformUserId ?? "";
  const raw = req.body;
  const edgeId =
    raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { edgeId?: unknown }).edgeId === "string"
      ? String((raw as { edgeId: string }).edgeId).trim()
      : "";
  if (!edgeId) {
    res.status(400).json({ error: "edgeId_required" });
    return;
  }
  const out = await startMoneyTrackingForUser(edgeId, userId);
  if (!out.ok) {
    res.status(out.httpStatus).json({ error: out.error });
    return;
  }
  res.json({ ok: true });
}
