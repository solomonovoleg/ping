import { getEdgePool } from "../db/pool.js";
import { ensureEdgeCampaign, findCampaignByPublicId } from "../companion/repo.js";
import { computeInteractLocked } from "../companion/interact-lock.js";
import { ensureParticipant } from "../participant/participant-repo.js";
import { reconcileCharacterDecay } from "../participant/decay-sync.js";
import { effectiveLeaderboardXpFrozen } from "../participant/leaderboard-draw-freeze.js";
import { applyTaskXpToParticipant, getParticipantState } from "../participant/service.js";
import { sanitizeTaskRef } from "./apply-task.js";
import { tryInsertTaskGrant } from "./grants-repo.js";
import {
  effectiveTaskPresetScoreTarget,
  hasObjectiveTaskVerify,
} from "../../shared/edge-task-preset-config.js";
import { findTaskPresetByKey, needsEdgeVerify } from "./preset-tasks-parse.js";
import type { TaskDenyReason, TaskRewardResponse } from "./types.js";
import { readGameScriptMetrics } from "../participant/game-script-metrics.js";
import { parseExtra } from "../participant/participant-extra.js";

export async function applyPresetTaskReward(
  edgeId: string,
  platformUserId: string,
  taskKey: string,
  refRaw: string,
): Promise<(TaskRewardResponse & { denyReason?: TaskDenyReason }) | null> {
  if (!getEdgePool()) return null;

  await ensureEdgeCampaign(edgeId);
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;

  if (computeInteractLocked(campaign)) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "campaign_locked" };
  }

  if (String(campaign.status || "").toLowerCase() !== "published") {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "not_published" };
  }

  const preset = findTaskPresetByKey(campaign.config_json, taskKey);
  if (!preset) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "invalid_preset" };
  }

  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;

  const joinedAtMs = p.joined_at instanceof Date ? p.joined_at.getTime() : new Date(p.joined_at).getTime();
  const deadlineMs = preset.deadlineDays * 86_400_000;
  if (!Number.isFinite(joinedAtMs) || Date.now() > joinedAtMs + deadlineMs) {
    await reconcileCharacterDecay(p.id);
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "deadline_passed" };
  }

  const xpDelta = Math.max(-500, Math.min(500, Math.floor(preset.points - preset.penalty)));
  const scoreTarget = effectiveTaskPresetScoreTarget(preset);
  const refKey = sanitizeTaskRef(refRaw);

  const c0 = await reconcileCharacterDecay(p.id);
  if (!c0) return null;

  const v = preset.verify;
  const now = new Date();

  if (!hasObjectiveTaskVerify(v)) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "honor_disabled" };
  }

  if (xpDelta !== 0 && effectiveLeaderboardXpFrozen(campaign, scoreTarget, now)) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "leaderboard_frozen" };
  }
  if (needsEdgeVerify(v)) {
    if (v.type === "edge_min_level" && c0.level < v.minLevel) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_min_xp" && c0.xp < v.minXp) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_min_care_streak" && c0.care_streak_days < v.minDays) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }

    const gm = readGameScriptMetrics(parseExtra(c0.extra), now);
    if (v.type === "edge_game_login_streak" && gm.gameLoginStreakDays < v.minDays) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_game_daily_taps" && gm.dailyTapCount < v.minCount) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_game_daily_feeds" && gm.dailyFeedCount < v.minCount) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_game_daily_play" && gm.dailyPlayCount < v.minCount) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_game_daily_toilet" && gm.dailyToiletCount < v.minCount) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_game_daily_calm" && gm.dailyCalmCount < v.minCount) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
    if (v.type === "edge_game_daily_pet" && gm.dailyPetCount < v.minCount) {
      const state = await getParticipantState(edgeId, platformUserId);
      if (!state) return null;
      return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "verification_failed" };
    }
  }

  const inserted = await tryInsertTaskGrant(edgeId, platformUserId, taskKey, refKey, xpDelta);
  if (inserted === null) return null;

  if (!inserted) {
    const state = await getParticipantState(edgeId, platformUserId);
    if (!state) return null;
    return { awarded: false, xpDelta: 0, taskKey, state, denyReason: "already_claimed" };
  }

  const c1 = await applyTaskXpToParticipant(campaign, p.id, xpDelta, now, scoreTarget);
  if (!c1) return null;

  const state = await getParticipantState(edgeId, platformUserId);
  if (!state) return null;
  return { awarded: true, xpDelta, taskKey, state };
}
