import type { Request, Response } from "express";
import { notifyChatListUpdate } from "../../calls/ws";
import { getUserId } from "../../auth/session";
import { sendChatMessage } from "../../messages/service";
import { storage } from "../../storage";
import { fetchUpstreamMoneyCampaignConfig } from "../../edge/upstream-client";
import { ensureMoneyCampaignJsonVisibleToViewer } from "../../edge/money-campaign-viewer-access";
import { evaluateNewEdgeMoneyInviteBatchAllowed } from "../gate-next-batch/evaluate-new-batch-allowed";
import { getDb } from "../../db";
import { DEFAULT_MONEY_INVITE_DM_TEMPLATE } from "../shared-defaults/default-money-invite-dm-template";
import { buildMoneyInviteDmText } from "./build-money-invite-dm-text";
import { evaluateMoneyInviteIssueEligibility } from "./money-invite-issue-eligibility";
import { markMoneyInviteIssued, rateLimitMoneyInviteIssue } from "./money-invite-issue-rate-limit";
import { parseMoneyUpstreamJson } from "./parse-money-upstream-json";
import { runMoneyInvitePackTransaction } from "./run-money-invite-pack-transaction";
import { fetchMoneyTrackingStartedFromEdge } from "../../edge/fetch-money-tracking";

export async function handlePostMoneyInvitePack(req: Request, res: Response): Promise<void> {
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

  const rl = rateLimitMoneyInviteIssue(userId, edgeId);
  if (!rl.ok) {
    res.status(429).json({ error: "rate_limited", retryAfterSec: rl.retryAfterSec });
    return;
  }

  const cfgUp = await fetchUpstreamMoneyCampaignConfig(edgeId);
  if (!cfgUp.ok || cfgUp.status < 200 || cfgUp.status >= 300) {
    res.status(503).json({ error: "edge_money_unavailable" });
    return;
  }
  if (!(await ensureMoneyCampaignJsonVisibleToViewer(cfgUp.body, userId, res))) return;

  const tracking = await fetchMoneyTrackingStartedFromEdge(edgeId, userId);
  if (tracking === null) {
    res.status(503).json({ error: "edge_money_unavailable" });
    return;
  }
  if (!tracking) {
    res.status(403).json({
      error: "money_tracking_required",
      message: "Сначала на вкладке «Задания» нажмите «Начать отслеживание заданий».",
    });
    return;
  }

  const parsed = parseMoneyUpstreamJson(cfgUp.body);
  const elig = evaluateMoneyInviteIssueEligibility(parsed, DEFAULT_MONEY_INVITE_DM_TEMPLATE);
  if (!elig.ok) {
    res.status(elig.status).json({ error: elig.error });
    return;
  }

  const db = getDb();
  const gate = await evaluateNewEdgeMoneyInviteBatchAllowed(db, userId, edgeId);
  if (!gate.allowed) {
    res.status(409).json({
      error: gate.reason ?? "invite_batch_blocked",
      openBatchId: gate.openBatchId,
    });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + elig.codeExpiresInHours * 3_600_000);

  try {
    const { batchId, codes } = await runMoneyInvitePackTransaction(userId, edgeId, expiresAt);
    const appLink = (process.env.PING_INVITE_APP_URL ?? "").trim();
    const text = buildMoneyInviteDmText({
      template: elig.template,
      codes,
      appLink,
    });
    const chat = await storage.getOrCreateDmChat(elig.creatorId, userId);
    await sendChatMessage({
      userId: elig.creatorId,
      chatId: chat.id,
      content: text,
      type: "text",
    });
    notifyChatListUpdate(userId);
    markMoneyInviteIssued(userId, edgeId);
    res.json({
      ok: true,
      chatId: chat.id,
      batchId,
      codesCount: codes.length,
      hint: "Откройте вкладку «Чаты» внизу экрана — сообщение от автора кампании.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invite_pack_failed";
    console.error("[edge-money-invite/pack]", e);
    res.status(500).json({ error: "invite_pack_failed", message: msg });
  }
}
