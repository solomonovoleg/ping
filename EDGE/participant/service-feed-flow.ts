import type { ParticipantStatePayload } from "./types.js";
import { applyFeedTapProgress } from "./character-rules.js";
import { ensureParticipant, updateCharacterFeedFull } from "./repo.js";
import { reconcileCharacterDecay } from "./decay-sync.js";
import { mapPayloadEnriched } from "./service-helpers.js";
import { ensurePlayAccess } from "./service-play-access.js";
import { buildFeedCompletionUpdate } from "./service-feed-completion.js";
import { persistPartialProgress } from "./service-partial-progress.js";
import { buildPartialProgressParams } from "./service-partial-progress-input.js";
import { buildSimulationSnapshot } from "./service-simulation.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { effectiveLeaderboardXpFrozen } from "./leaderboard-draw-freeze.js";

export async function postParticipantFeedCore(
  edgeId: string,
  platformUserId: string,
): Promise<ParticipantStatePayload | "locked" | null> {
  const access = await ensurePlayAccess(edgeId);
  if (access !== "ok") return access;
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;
  const c0 = await reconcileCharacterDecay(p.id);
  if (!c0) return null;

  const now = new Date();
  const sim = buildSimulationSnapshot(c0.extra, now);
  const tap = applyFeedTapProgress(sim.extra);

  if (!tap.completed) {
    return persistPartialProgress(buildPartialProgressParams({
      now,
      edgeId,
      platformUserId,
      participant: p,
      campaignConfigJson: campaign.config_json,
      xp: c0.xp,
      happy: sim.happy,
      mood: sim.mood,
      level: c0.level,
      extra: tap.extra,
    }));
  }

  const primaryBlocked = effectiveLeaderboardXpFrozen(campaign, "primary", now);
  const update = buildFeedCompletionUpdate({
    tapExtra: tap.extra,
    careStreakDays: c0.care_streak_days,
    now,
    baseXp: c0.xp,
    baseLevel: c0.level,
    primaryBlocked,
    campaignConfigJson: campaign.config_json,
    prevMood: c0.mood,
  });

  const c = await updateCharacterFeedFull(p.id, {
    now,
    xp: update.xp,
    happy: update.happy,
    mood: update.mood,
    level: update.level,
    streak: update.streak,
    extra: update.extra,
  });
  if (!c) return null;
  return mapPayloadEnriched(edgeId, platformUserId, p, c, now, campaign.config_json);
}
