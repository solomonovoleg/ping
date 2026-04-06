import type { Request, Response } from "express";
import { sumXpForTaskKey } from "../../../tasks/grants-repo.js";
import { MONEY_INVITE_TASK_KEY } from "../../platform-events/invite-points-from-config.js";

export async function getMoneyInviteGrantsSum(req: Request, res: Response): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    const platformUserId = String(req.query.platformUserId ?? "").trim();
    if (!edgeId || !platformUserId) {
      res.status(400).json({ error: "edgeId_and_platformUserId_required" });
      return;
    }
    const sum = await sumXpForTaskKey(edgeId, platformUserId, MONEY_INVITE_TASK_KEY);
    if (sum === null) {
      res.status(500).json({ error: "sum_failed" });
      return;
    }
    res.json({ taskKey: MONEY_INVITE_TASK_KEY, pointsAwardedForInviteTask: sum });
  } catch (e) {
    console.error("[edge/money/invite-grants-sum]", e);
    res.status(500).json({ error: "internal_error" });
  }
}
