import { findCampaignByPublicId } from "../../companion/repo.js";
import { reconcileCharacterDecay } from "../../participant/decay-sync.js";
import { getMoneyParticipantIdIfTrackingActive } from "../participant-money-tracking.js";
import { applyTaskXpToParticipant } from "../../participant/service.js";
import { tryInsertTaskGrant } from "../../tasks/grants-repo.js";
import { sumXpForTaskKeyUtcDay } from "../../tasks/sum-xp-for-task-key-utc-day.js";
import { effectiveLeaderboardXpFrozen } from "../../participant/leaderboard-draw-freeze.js";
import { parseMoneyConfigFromRoot } from "../config/parse-money-config.js";
import { MONEY_CHAT_TASK_KEY } from "./chat-task-key.js";

export type ApplyChatMilestoneResult =
  | { ok: true; awarded: true; xpDelta: number }
  | { ok: true; awarded: false; reason: string; xpDelta: 0 };

const REF_MAX = 220;

function sanitizeRefPart(raw: string): string {
  const t = raw.trim().slice(0, REF_MAX);
  return t.length > 0 ? t : "_";
}

function refKeyForMilestone(chatId: string, blockIndex: number): string {
  const c = sanitizeRefPart(chatId);
  const key = `c:${c}:b:${Math.floor(blockIndex)}`;
  return key.length <= 256 ? key : `h:${blockIndex}:${c.slice(0, 200)}`;
}

export async function applyChatMessagesMilestoneEvent(opts: {
  edgeId: string;
  platformUserId: string;
  chatId: string;
  blockIndex: number;
}): Promise<ApplyChatMilestoneResult | null> {
  const edgeId = opts.edgeId.trim();
  const user = opts.platformUserId.trim();
  const chatId = opts.chatId.trim();
  const blockIndex = Math.floor(opts.blockIndex);
  if (!edgeId || !user || !chatId || blockIndex < 1) return null;

  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;
  if ((campaign.edge_type || "").trim() !== "money") {
    return { ok: true, awarded: false, reason: "edge_type_not_money", xpDelta: 0 };
  }
  if (String(campaign.status || "").toLowerCase() !== "published") {
    return { ok: true, awarded: false, reason: "campaign_not_published", xpDelta: 0 };
  }

  const parsed = parseMoneyConfigFromRoot(campaign.config_json);
  const rule = parsed.scoringRules.find((r) => r.kind === "chat_messages" && r.enabled !== false);
  if (!rule || rule.points <= 0) {
    return { ok: true, awarded: false, reason: "chat_rule_disabled_or_zero", xpDelta: 0 };
  }

  let xpDelta = Math.min(1_000_000, Math.floor(rule.points));
  const maxDay = rule.maxPointsPerDay ?? 0;
  const now = new Date();
  if (maxDay > 0) {
    const spent = await sumXpForTaskKeyUtcDay(edgeId, user, MONEY_CHAT_TASK_KEY, now);
    if (spent === null) return null;
    const remaining = maxDay - spent;
    if (remaining <= 0) {
      return { ok: true, awarded: false, reason: "daily_cap_exhausted", xpDelta: 0 };
    }
    if (xpDelta > remaining) {
      xpDelta = remaining;
    }
  }

  const participantId = await getMoneyParticipantIdIfTrackingActive(edgeId, user);
  if (!participantId) {
    return { ok: true, awarded: false, reason: "money_tracking_not_started", xpDelta: 0 };
  }
  const c0 = await reconcileCharacterDecay(participantId);
  if (!c0) return null;

  const scoreTarget: "primary" | "secondary" = campaign.leaderboard_secondary_enabled
    ? "secondary"
    : "primary";
  if (xpDelta !== 0 && effectiveLeaderboardXpFrozen(campaign, scoreTarget, now)) {
    return {
      ok: true,
      awarded: false,
      reason: scoreTarget === "secondary" ? "leaderboard_secondary_frozen" : "leaderboard_primary_frozen",
      xpDelta: 0,
    };
  }

  const refKey = refKeyForMilestone(chatId, blockIndex);
  const inserted = await tryInsertTaskGrant(edgeId, user, MONEY_CHAT_TASK_KEY, refKey, xpDelta);
  if (inserted === null) return null;
  if (!inserted) {
    return { ok: true, awarded: false, reason: "already_accrued_for_milestone", xpDelta: 0 };
  }

  const c1 = await applyTaskXpToParticipant(campaign, participantId, xpDelta, now, scoreTarget);
  if (!c1) return null;
  return { ok: true, awarded: true, xpDelta };
}
