import type { Request, Response } from "express";
import { listMoneyChatAccrualTargetsForPlatformUser } from "../../queries/list-money-chat-accrual-targets.js";

export async function getMoneyChatAccrualTargets(req: Request, res: Response): Promise<void> {
  const platformUserId = String(req.query.platformUserId ?? "").trim();
  if (!platformUserId) {
    res.status(400).json({ error: "platformUserId_required" });
    return;
  }
  const targets = await listMoneyChatAccrualTargetsForPlatformUser(platformUserId);
  if (targets === null) {
    res.status(503).json({ error: "edge_unavailable" });
    return;
  }
  res.json({ targets });
}
