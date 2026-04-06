import type { Request, Response } from "express";
import { hasTaskGrantForKey } from "../../../tasks/grants-repo.js";
import { MONEY_FOLLOW_CREATOR_TASK_KEY } from "../../platform-events/money-follow-creator-task-key.js";

export async function getMoneyParticipantSnippet(req: Request, res: Response): Promise<void> {
  const edgeId = String(req.query.edgeId ?? "").trim();
  const platformUserId = String(req.query.platformUserId ?? "").trim();
  if (!edgeId || !platformUserId) {
    res.status(400).json({ error: "edgeId_and_platformUserId_required" });
    return;
  }
  const follow = await hasTaskGrantForKey(edgeId, platformUserId, MONEY_FOLLOW_CREATOR_TASK_KEY);
  if (follow === null) {
    res.status(503).json({ error: "edge_unavailable" });
    return;
  }
  res.json({ followCreatorCompleted: follow });
}
