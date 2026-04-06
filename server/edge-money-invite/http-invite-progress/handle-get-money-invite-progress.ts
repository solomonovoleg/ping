import type { Request, Response } from "express";
import { getUserId } from "../../auth/session";
import { fetchUpstreamMoneyCampaignConfig } from "../../edge/upstream-client";
import { ensureMoneyCampaignJsonVisibleToViewer } from "../../edge/money-campaign-viewer-access";
import { fetchMoneyInviteGrantsSumFromEdge } from "../../edge/fetch-money-invite-grants-sum";
import { getDb } from "../../db";
import { aggregateEdgeMoneyBatchCodeStats } from "../batch-stats/aggregate-batch-code-stats";
import { evaluateNewEdgeMoneyInviteBatchAllowed } from "../gate-next-batch/evaluate-new-batch-allowed";
import { selectOpenInviteBatchForUserEdge } from "../select-open-batch/select-open-invite-batch";
import { DEFAULT_MONEY_INVITE_DM_TEMPLATE } from "../shared-defaults/default-money-invite-dm-template";
import { evaluateMoneyInviteIssueEligibility } from "../http-issue-pack/money-invite-issue-eligibility";
import { parseMoneyUpstreamJson } from "../http-issue-pack/parse-money-upstream-json";

export async function handleGetMoneyInviteProgress(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const edgeId = String(req.query.edgeId ?? "").trim();
  if (!edgeId) {
    res.status(400).json({ error: "edgeId_required" });
    return;
  }

  const cfgUp = await fetchUpstreamMoneyCampaignConfig(edgeId);
  if (!cfgUp.ok || cfgUp.status < 200 || cfgUp.status >= 300) {
    res.status(503).json({ error: "edge_money_unavailable" });
    return;
  }
  if (!(await ensureMoneyCampaignJsonVisibleToViewer(cfgUp.body, userId, res))) return;

  const parsed = parseMoneyUpstreamJson(cfgUp.body);
  const elig = evaluateMoneyInviteIssueEligibility(parsed, DEFAULT_MONEY_INVITE_DM_TEMPLATE);
  if (!elig.ok) {
    res.status(elig.status).json({ error: elig.error });
    return;
  }

  const rules = Array.isArray(parsed?.money?.scoringRules) ? parsed!.money!.scoringRules! : [];
  const inviteRule = rules.find((r) => (r.kind || "").trim() === "invite_friend" && r.enabled !== false);
  const pointsPerThreshold =
    inviteRule && typeof inviteRule.points === "number" && Number.isFinite(inviteRule.points)
      ? Math.max(0, Math.floor(inviteRule.points))
      : 0;
  const threshold =
    inviteRule && typeof inviteRule.threshold === "number" && Number.isFinite(inviteRule.threshold)
      ? Math.max(1, Math.floor(inviteRule.threshold))
      : 1;

  const db = getDb();
  const gate = await evaluateNewEdgeMoneyInviteBatchAllowed(db, userId, edgeId);
  const open = await selectOpenInviteBatchForUserEdge(db, userId, edgeId);
  const stats = open ? await aggregateEdgeMoneyBatchCodeStats(db, open.id) : { codeCount: 0, registrationsTotal: 0 };

  let pointsAwardedForInviteTask = 0;
  const sumFromEdge = await fetchMoneyInviteGrantsSumFromEdge(edgeId, userId);
  if (sumFromEdge !== null) pointsAwardedForInviteTask = sumFromEdge;

  res.json({
    edgeId,
    inviteTaskEnabled: true,
    pointsAwardedForInviteTask,
    pointsPerThreshold,
    threshold,
    batchId: open?.id ?? null,
    slotCount: open?.slotCount ?? 0,
    codesIssuedInOpenBatch: stats.codeCount,
    registrationsFromOpenBatchCodes: stats.registrationsTotal,
    canRequestNewBatch: gate.allowed,
    pendingReason: gate.allowed ? undefined : gate.reason,
  });
}
