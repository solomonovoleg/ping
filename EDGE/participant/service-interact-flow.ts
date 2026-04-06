import type { InteractKind } from "./character-rules.js";
import { ensureParticipant, updateCharacterAfterInteract } from "./repo.js";
import { reconcileCharacterDecay } from "./decay-sync.js";
import { mapPayloadEnriched } from "./service-helpers.js";
import { ensurePlayAccess } from "./service-play-access.js";
import {
  resolveInteractCooldownOutcome,
  type PostInteractOutcome,
} from "./service-interact-cooldown.js";
import { applyInteractTapOutcome } from "./service-interact-tap.js";
import { buildInteractCompletionUpdate } from "./service-interact-completion.js";
import { persistPartialProgress } from "./service-partial-progress.js";
import { buildPartialProgressParams } from "./service-partial-progress-input.js";
import { buildSimulationSnapshot } from "./service-simulation.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { effectiveLeaderboardXpFrozen } from "./leaderboard-draw-freeze.js";

export async function postParticipantInteractCore(
  edgeId: string,
  platformUserId: string,
  kind: InteractKind,
): Promise<PostInteractOutcome | "locked" | null> {
  const access = await ensurePlayAccess(edgeId);
  if (access !== "ok") return access;
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;
  const c0 = await reconcileCharacterDecay(p.id);
  if (!c0) return null;
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;

  const now = new Date();
  const sim = buildSimulationSnapshot(c0.extra, now);
  const cooldown = resolveInteractCooldownOutcome(sim.extra, kind, now);
  if (cooldown) return cooldown;

  const tapOutcome = applyInteractTapOutcome(sim.extra, kind, now);
  if (!tapOutcome.completed) {
    const partial = await persistPartialProgress(buildPartialProgressParams({
      now,
      edgeId,
      platformUserId,
      participant: p,
      campaignConfigJson: campaign.config_json,
      xp: c0.xp,
      happy: sim.happy,
      mood: sim.mood,
      level: c0.level,
      extra: tapOutcome.extra,
    }));
    if (!partial) return null;
    return { ok: true, state: partial };
  }

  const primaryBlocked = effectiveLeaderboardXpFrozen(campaign, "primary", now);
  const update = buildInteractCompletionUpdate({
    kind,
    tapExtra: tapOutcome.extra,
    now,
    campaignConfigJson: campaign.config_json,
    primaryBlocked,
    baseXp: c0.xp,
    baseLevel: c0.level,
    prevMood: c0.mood,
  });

  const c = await updateCharacterAfterInteract(p.id, {
    now,
    xp: update.xp,
    happy: update.happy,
    mood: update.mood,
    level: update.level,
    extra: update.extra,
  });
  if (!c) return null;
  return { ok: true, state: await mapPayloadEnriched(edgeId, platformUserId, p, c, now, campaign.config_json) };
}
