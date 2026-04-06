import type { Request, Response } from "express";
import { and, eq, max } from "drizzle-orm";
import { getUserId } from "../auth/session";
import { getDb } from "../db";
import {
  edgeMoneyCallMinuteCounters,
  edgeMoneyChatMessageCounters,
  edgeMoneyPostCounters,
  edgeMoneyProfileLikeCounters,
} from "@shared/schema";
import { aggregateEdgeMoneyBatchCodeStats } from "../edge-money-invite/batch-stats/aggregate-batch-code-stats";
import { selectOpenInviteBatchForUserEdge } from "../edge-money-invite/select-open-batch/select-open-invite-batch";
import { evaluateMoneyInviteIssueEligibility } from "../edge-money-invite/http-issue-pack/money-invite-issue-eligibility";
import { parseMoneyUpstreamJson } from "../edge-money-invite/http-issue-pack/parse-money-upstream-json";
import { DEFAULT_MONEY_INVITE_DM_TEMPLATE } from "../edge-money-invite/shared-defaults/default-money-invite-dm-template";
import { ensureMoneyCampaignJsonVisibleToViewer } from "./money-campaign-viewer-access";
import { fetchMoneyInviteGrantsSumFromEdge } from "./fetch-money-invite-grants-sum";
import { fetchMoneyParticipantSnippetFromEdge } from "./fetch-money-participant-snippet";
import { fetchMoneyTrackingStartedFromEdge } from "./fetch-money-tracking";
import { fetchUpstreamMoneyCampaignConfig } from "./upstream-client";

export type MoneyTaskProgressInviteDto = {
  codesIssuedInOpenBatch: number;
  registrationsFromOpenBatchCodes: number;
  pointsAwardedForInviteTask: number;
  pointsPerThreshold: number;
  threshold: number;
};

export type MoneyTaskProgressItemDto = {
  kind: string;
  ruleId: string;
  threshold: number;
  points: number;
  trackingActive: boolean;
  /** Доля заполнения текущего шага (0..1), null если не применимо */
  ratio: number | null;
  label: string;
  detail: string;
  invite?: MoneyTaskProgressInviteDto;
  followCompleted?: boolean;
};

export type MoneyTaskProgressResponseDto = {
  edgeId: string;
  trackingStarted: boolean;
  updatedAt: string;
  tasks: MoneyTaskProgressItemDto[];
};

function milestoneRatio(raw: number, threshold: number): { ratio: number; detail: string } {
  const th = Math.max(1, Math.floor(threshold));
  const m = Math.max(0, Math.floor(raw));
  const mod = m % th;
  const justHit = m > 0 && mod === 0;
  if (m === 0) {
    return { ratio: 0, detail: `0 / ${th} до следующего начисления` };
  }
  if (justHit) {
    return { ratio: 1, detail: `Шаг ${th}/${th} выполнен — продолжайте, следующий засчитается после новой активности` };
  }
  return { ratio: mod / th, detail: `${mod} / ${th} до следующего начисления` };
}

/** Короткие подписи для задания «пригласи друга» в UI. */
function inviteFriendMilestoneDetail(
  registrationsInBatch: number,
  threshold: number,
  pointsAwardedTotal: number,
): { ratio: number; detail: string } {
  const th = Math.max(1, Math.floor(threshold));
  const m = Math.max(0, Math.floor(registrationsInBatch));
  const mod = m % th;
  const justHit = m > 0 && mod === 0;
  const tail = ` · +${pointsAwardedTotal} в рейтинг`;
  if (m === 0) {
    return { ratio: 0, detail: `Ждём регистрацию по коду${tail}` };
  }
  if (justHit) {
    return { ratio: 1, detail: `Засчитано — следующий + после новых друзей${tail}` };
  }
  return { ratio: mod / th, detail: `До +: ${mod} / ${th}${tail}` };
}

export async function handleGetMoneyTaskProgress(req: Request, res: Response): Promise<void> {
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
  const rules = Array.isArray(parsed?.money?.scoringRules) ? parsed!.money!.scoringRules! : [];
  const activeRules = rules.filter(
    (r) => r && typeof r === "object" && (r as { enabled?: boolean }).enabled !== false,
  ) as Array<{
    id?: string;
    kind?: string;
    threshold?: number;
    points?: number;
  }>;

  const trackingStarted = (await fetchMoneyTrackingStartedFromEdge(edgeId, userId)) === true;
  const snippet = trackingStarted ? await fetchMoneyParticipantSnippetFromEdge(edgeId, userId) : null;

  const db = getDb();
  const [chatMax] = await db
    .select({ v: max(edgeMoneyChatMessageCounters.sentCount) })
    .from(edgeMoneyChatMessageCounters)
    .where(and(eq(edgeMoneyChatMessageCounters.userId, userId), eq(edgeMoneyChatMessageCounters.edgeId, edgeId)));
  const [callMax] = await db
    .select({ v: max(edgeMoneyCallMinuteCounters.minuteTotal) })
    .from(edgeMoneyCallMinuteCounters)
    .where(and(eq(edgeMoneyCallMinuteCounters.userId, userId), eq(edgeMoneyCallMinuteCounters.edgeId, edgeId)));
  const [postRow] = await db
    .select({ v: edgeMoneyPostCounters.postCount })
    .from(edgeMoneyPostCounters)
    .where(and(eq(edgeMoneyPostCounters.userId, userId), eq(edgeMoneyPostCounters.edgeId, edgeId)))
    .limit(1);
  const [likeRow] = await db
    .select({ v: edgeMoneyProfileLikeCounters.receivedCount })
    .from(edgeMoneyProfileLikeCounters)
    .where(
      and(eq(edgeMoneyProfileLikeCounters.recipientUserId, userId), eq(edgeMoneyProfileLikeCounters.edgeId, edgeId)),
    )
    .limit(1);

  const chatRaw = Number(chatMax?.v ?? 0) || 0;
  const callRaw = Number(callMax?.v ?? 0) || 0;
  const postRaw = Number(postRow?.v ?? 0) || 0;
  const likeRaw = Number(likeRow?.v ?? 0) || 0;

  const tasks: MoneyTaskProgressItemDto[] = [];
  const elig = evaluateMoneyInviteIssueEligibility(parsed, DEFAULT_MONEY_INVITE_DM_TEMPLATE);
  const openBatch = elig.ok ? await selectOpenInviteBatchForUserEdge(db, userId, edgeId) : null;
  const batchStats = openBatch ? await aggregateEdgeMoneyBatchCodeStats(db, openBatch.id) : { codeCount: 0, registrationsTotal: 0 };
  let invitePoints = 0;
  const sumInv = await fetchMoneyInviteGrantsSumFromEdge(edgeId, userId);
  if (sumInv !== null) invitePoints = sumInv;

  for (const r of activeRules) {
    const kind = typeof r.kind === "string" ? r.kind.trim() : "";
    const ruleId = typeof r.id === "string" && r.id.trim() ? r.id.trim() : kind;
    const th = Math.max(1, Math.floor(Number(r.threshold) || 1));
    const pts = Math.max(0, Math.floor(Number(r.points) || 0));
    if (!kind) continue;

    if (kind === "invite_friend") {
      if (!elig.ok) continue;
      const inviteRule = rules.find((x) => (x as { kind?: string }).kind === "invite_friend");
      const inviteThreshold =
        inviteRule && typeof (inviteRule as { threshold?: number }).threshold === "number"
          ? Math.max(1, Math.floor((inviteRule as { threshold: number }).threshold))
          : 1;
      const pointsPer =
        inviteRule && typeof (inviteRule as { points?: number }).points === "number"
          ? Math.max(0, Math.floor((inviteRule as { points: number }).points))
          : pts;
      const regs = batchStats.registrationsTotal;
      const mr = inviteFriendMilestoneDetail(regs, inviteThreshold, invitePoints);
      tasks.push({
        kind,
        ruleId,
        threshold: inviteThreshold,
        points: pointsPer,
        trackingActive: trackingStarted,
        ratio: trackingStarted ? mr.ratio : null,
        label: "Приглашения",
        detail: trackingStarted
          ? mr.detail
          : "Включите отслеживание заданий на вкладке «Задания»",
        invite: {
          codesIssuedInOpenBatch: batchStats.codeCount,
          registrationsFromOpenBatchCodes: regs,
          pointsAwardedForInviteTask: invitePoints,
          pointsPerThreshold: pointsPer,
          threshold: inviteThreshold,
        },
      });
      continue;
    }

    if (kind === "follow_creator") {
      const done = snippet?.followCreatorCompleted === true;
      tasks.push({
        kind,
        ruleId,
        threshold: th,
        points: pts,
        trackingActive: trackingStarted,
        ratio: trackingStarted ? (done ? 1 : 0) : null,
        label: "Подписка на создателя",
        detail: trackingStarted
          ? done
            ? "Подписка засчитана"
            : "Подпишитесь на страницу создателя кампании"
          : "Включите отслеживание заданий на вкладке «Задания»",
        followCompleted: done,
      });
      continue;
    }

    let raw = 0;
    let label = kind;
    if (kind === "chat_messages") {
      raw = chatRaw;
      label = "Сообщения в чате";
    } else if (kind === "video_call_minutes") {
      raw = callRaw;
      label = "Минуты звонка 1:1";
    } else if (kind === "post_created") {
      raw = postRaw;
      label = "Посты в ленте";
    } else if (kind === "profile_likes_received") {
      raw = likeRaw;
      label = "Реакции на ваши посты";
    } else {
      continue;
    }

    const mr = milestoneRatio(raw, th);
    tasks.push({
      kind,
      ruleId,
      threshold: th,
      points: pts,
      trackingActive: trackingStarted,
      ratio: trackingStarted ? mr.ratio : null,
      label,
      detail: trackingStarted ? mr.detail : "Включите отслеживание заданий на вкладке «Задания»",
    });
  }

  res.json({
    edgeId,
    trackingStarted,
    updatedAt: new Date().toISOString(),
    tasks,
  } satisfies MoneyTaskProgressResponseDto);
}
