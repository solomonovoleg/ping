import { findCampaignByPublicId } from "../../companion/repo.js";
import { reconcileCharacterDecay } from "../../participant/decay-sync.js";
import { getMoneyParticipantIdIfTrackingActive } from "../participant-money-tracking.js";
import { applyTaskXpToParticipant } from "../../participant/service.js";
import { tryInsertTaskGrant } from "../../tasks/grants-repo.js";
import { effectiveLeaderboardXpFrozen } from "../../participant/leaderboard-draw-freeze.js";
import { inviteFriendPointsFromMoneyConfig, MONEY_INVITE_TASK_KEY } from "./invite-points-from-config.js";

export type ApplyInviteRegisteredResult =
  | { ok: true; awarded: true; xpDelta: number }
  | { ok: true; awarded: false; reason: string; xpDelta: 0 };

const REF_MAX = 240;

function sanitizeRef(raw: string): string {
  const t = raw.trim().slice(0, REF_MAX);
  return t.length > 0 ? t : "_";
}

export async function applyInviteRegisteredMoneyEvent(opts: {
  edgeId: string;
  inviterPlatformUserId: string;
  referralCodeId: string;
}): Promise<ApplyInviteRegisteredResult | null> {
  const edgeId = opts.edgeId.trim();
  const inviter = opts.inviterPlatformUserId.trim();
  const refKey = sanitizeRef(opts.referralCodeId);
  if (!edgeId || !inviter || !refKey || refKey === "_") return null;

  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;
  if ((campaign.edge_type || "").trim() !== "money") {
    return { ok: true, awarded: false, reason: "edge_type_not_money", xpDelta: 0 };
  }
  if (String(campaign.status || "").toLowerCase() !== "published") {
    return { ok: true, awarded: false, reason: "campaign_not_published", xpDelta: 0 };
  }

  const xpDelta = inviteFriendPointsFromMoneyConfig(campaign.config_json);
  if (xpDelta <= 0) {
    return { ok: true, awarded: false, reason: "invite_rule_disabled_or_zero", xpDelta: 0 };
  }

  const participantId = await getMoneyParticipantIdIfTrackingActive(edgeId, inviter);
  if (!participantId) {
    return { ok: true, awarded: false, reason: "money_tracking_not_started", xpDelta: 0 };
  }
  const c0 = await reconcileCharacterDecay(participantId);
  if (!c0) return null;

  const now = new Date();
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

  const inserted = await tryInsertTaskGrant(edgeId, inviter, MONEY_INVITE_TASK_KEY, refKey, xpDelta);
  if (inserted === null) return null;
  if (!inserted) {
    return { ok: true, awarded: false, reason: "already_accrued_for_code", xpDelta: 0 };
  }

  const c1 = await applyTaskXpToParticipant(campaign, participantId, xpDelta, now, scoreTarget);
  if (!c1) return null;
  return { ok: true, awarded: true, xpDelta };
}
