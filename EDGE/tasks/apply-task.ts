import { getEdgePool } from "../db/pool.js";
import { ensureEdgeCampaign, findCampaignByPublicId } from "../companion/repo.js";
import { ensureParticipant } from "../participant/participant-repo.js";
import { reconcileCharacterDecay } from "../participant/decay-sync.js";
import { effectiveLeaderboardXpFrozen } from "../participant/leaderboard-draw-freeze.js";
import {
  applyTaskXpToParticipant,
  getParticipantState,
} from "../participant/service.js";
import { taskXpForKey } from "./config-parse.js";
import { tryInsertTaskGrant } from "./grants-repo.js";
import { TASK_KEYS, type TaskKey, type TaskRewardResponse } from "./types.js";

const REF_MAX = 240;

export function sanitizeTaskRef(raw: string): string {
  const t = raw.trim().slice(0, REF_MAX);
  return t.length > 0 ? t : "_";
}

export function parseTaskKey(raw: unknown): TaskKey | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim() as TaskKey;
  return TASK_KEYS.includes(k) ? k : null;
}

export async function applyTaskReward(
  edgeId: string,
  platformUserId: string,
  taskKey: TaskKey,
  refRaw: string,
): Promise<TaskRewardResponse | null> {
  if (!getEdgePool()) return null;

  const refKey = sanitizeTaskRef(refRaw);
  await ensureEdgeCampaign(edgeId);
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;

  if (taskKey === "follow_creator") {
    if (!campaign.follow_reward_enabled) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state };
    }
    if (campaign.status !== "published") {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state };
    }
    const creator = campaign.creator_platform_user_id?.trim() ?? "";
    if (!creator || creator !== refKey) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state };
    }
  }

  const xpDelta = taskXpForKey(campaign.config_json, taskKey);
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;

  const c0 = await reconcileCharacterDecay(p.id);
  if (!c0) return null;

  const now = new Date();
  if (
    xpDelta !== 0 &&
    effectiveLeaderboardXpFrozen(campaign, "secondary", now)
  ) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "leaderboard_frozen" };
  }

  const inserted = await tryInsertTaskGrant(edgeId, platformUserId, taskKey, refKey, xpDelta);
  if (inserted === null) return null;

  if (!inserted) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "already_claimed" };
  }

  /** Встроенные ключи — действия в ленте / подписка; очки идут в дополнительный рейтинг. */
  const c1 = await applyTaskXpToParticipant(campaign, p.id, xpDelta, now, "secondary");
  if (!c1) return null;

  const state = await getParticipantState(edgeId, platformUserId);
  if (!state) return null;
  return { awarded: true, xpDelta, taskKey, state };
}
