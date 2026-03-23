import type { LeaderboardPayload, ParticipantStatePayload } from "./types.js";
import {
  applyFeedTapProgress,
  applyInteractTapProgress,
  applyNeedBonusByAction,
  happyFromNeeds,
  interactCooldownRemainingMs,
  interactNextAvailableIso,
  moodFromHappy,
  readNeeds,
  simulateNeedsToNow,
  withInteractTimestamp,
  writeNeeds,
  ymdUtc,
  computeStreakOnFeed,
  type InteractKind,
} from "./character-rules.js";
import {
  countCampaignParticipants,
  ensureParticipant,
  getParticipantRankInCampaign,
  incrementCharacterTaskXp,
  listCampaignLeaderboard,
  updateCharacterAfterInteract,
  updateCharacterExtraOnly,
  updateCharacterFeedFull,
  type CharacterRow,
  type ParticipantRow,
} from "./repo.js";
import {
  bumpDailyAfterFeed,
  bumpDailyAfterInteract,
  touchCompanionOpen,
} from "./game-script-metrics.js";
import { reconcileCharacterDecay } from "./decay-sync.js";
import { mapParticipantPayload, parseExtra } from "./payload.js";
import { getEdgePool } from "../db/pool.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { computeInteractLocked } from "../companion/interact-lock.js";

export type { ParticipantRow } from "./repo.js";

async function getCampaignPlayLocked(edgeId: string): Promise<boolean | null> {
  const row = await findCampaignByPublicId(edgeId);
  if (!row) return null;
  return computeInteractLocked(row);
}

function mapPayload(
  edgeId: string,
  platformUserId: string,
  p: ParticipantRow,
  c: CharacterRow,
  now: Date,
): ParticipantStatePayload {
  return mapParticipantPayload(edgeId, platformUserId, p, c, now);
}

export async function getParticipantState(
  edgeId: string,
  platformUserId: string,
): Promise<ParticipantStatePayload | null> {
  if (!getEdgePool()) return null;
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;
  let c = await reconcileCharacterDecay(p.id);
  if (!c) return null;
  const now = new Date();
  const extra0 = parseExtra(c.extra);
  const extra1 = touchCompanionOpen(extra0, now);
  if (JSON.stringify(extra0) !== JSON.stringify(extra1)) {
    const c2 = await updateCharacterExtraOnly(p.id, extra1, now);
    if (c2) c = c2;
  }
  return mapPayload(edgeId, platformUserId, p, c, now);
}

export async function postParticipantFeed(
  edgeId: string,
  platformUserId: string,
): Promise<ParticipantStatePayload | "locked" | null> {
  if (!getEdgePool()) return null;
  const locked = await getCampaignPlayLocked(edgeId);
  if (locked === null) return null;
  if (locked) return "locked";
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;
  const c0 = await reconcileCharacterDecay(p.id);
  if (!c0) return null;

  const now = new Date();
  const sim = simulateNeedsToNow(parseExtra(c0.extra), now);
  const tap = applyFeedTapProgress(sim.extra);

  if (!tap.completed) {
    const c = await updateCharacterAfterInteract(p.id, {
      now,
      xp: c0.xp,
      happy: sim.happy,
      mood: sim.mood,
      level: c0.level,
      extra: tap.extra,
    });
    if (!c) return null;
    return mapPayload(edgeId, platformUserId, p, c, now);
  }

  const fedNeeds = applyNeedBonusByAction(readNeeds(tap.extra), "feed");
  const fedHappy = happyFromNeeds(fedNeeds);
  const fedMood = moodFromHappy(fedHappy);
  const extraWithNeeds = writeNeeds(tap.extra, fedNeeds);
  const lastFedYmd = typeof extraWithNeeds.lastFedYmd === "string" ? extraWithNeeds.lastFedYmd : "";
  const streak = computeStreakOnFeed({
    careStreakDays: c0.care_streak_days,
    lastFedYmd,
    now,
  });
  const extraWithMetrics = bumpDailyAfterFeed(
    { ...extraWithNeeds, lastFedYmd: ymdUtc(now) },
    now,
  );
  const newXp = c0.xp + 10;
  const newLevel = Math.floor(newXp / 100);

  const c = await updateCharacterFeedFull(p.id, {
    now,
    xp: newXp,
    happy: fedHappy,
    mood: fedMood,
    level: newLevel,
    streak,
    extra: extraWithMetrics,
  });
  if (!c) return null;
  return mapPayload(edgeId, platformUserId, p, c, now);
}

export async function getCampaignLeaderboard(
  edgeId: string,
  platformUserId: string,
  limitRaw: number,
): Promise<LeaderboardPayload | null> {
  if (!getEdgePool()) return null;
  const limit = Math.min(100, Math.max(5, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 30));
  const total = await countCampaignParticipants(edgeId);
  if (total === null) return null;
  const rows = await listCampaignLeaderboard(edgeId, limit);
  if (rows === null) return null;
  const myRank = await getParticipantRankInCampaign(edgeId, platformUserId);
  const entries = rows.map((r, i) => ({
    rank: i + 1,
    xp: r.xp,
    level: r.level,
    careStreakDays: r.care_streak_days,
    isMe: r.platform_user_id === platformUserId,
  }));
  return {
    edgeId,
    entries,
    totalParticipants: total,
    myRank,
  };
}

export type PostInteractOutcome =
  | { ok: true; state: ParticipantStatePayload }
  | {
      ok: false;
      code: "cooldown";
      kind: InteractKind;
      nextAvailableAt: string;
    };

export async function postParticipantInteract(
  edgeId: string,
  platformUserId: string,
  kind: InteractKind,
): Promise<PostInteractOutcome | "locked" | null> {
  if (!getEdgePool()) return null;
  const locked = await getCampaignPlayLocked(edgeId);
  if (locked === null) return null;
  if (locked) return "locked";
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;
  const c0 = await reconcileCharacterDecay(p.id);
  if (!c0) return null;

  const now = new Date();
  const sim = simulateNeedsToNow(parseExtra(c0.extra), now);
  if (interactCooldownRemainingMs(sim.extra, kind, now) > 0) {
    const next = interactNextAvailableIso(sim.extra, kind, now);
    return {
      ok: false,
      code: "cooldown",
      kind,
      nextAvailableAt: next ?? new Date(now.getTime() + 60_000).toISOString(),
    };
  }

  const stepped = withInteractTimestamp(sim.extra, kind, now);
  const tapOutcome = applyInteractTapProgress(stepped, kind);
  if (!tapOutcome.completed) {
    const c = await updateCharacterAfterInteract(p.id, {
      now,
      xp: c0.xp,
      happy: sim.happy,
      mood: sim.mood,
      level: c0.level,
      extra: tapOutcome.extra,
    });
    if (!c) return null;
    return { ok: true, state: mapPayload(edgeId, platformUserId, p, c, now) };
  }

  const bonusXp =
    kind === "play" ? 6 : kind === "pet" ? 5 : kind === "toilet" ? 4 : kind === "calm" ? 5 : 1;
  const newXp = c0.xp + bonusXp;
  const newLevel = Math.floor(newXp / 100);
  const needsAfter = applyNeedBonusByAction(readNeeds(tapOutcome.extra), kind);
  const newHappy = happyFromNeeds(needsAfter);
  const newMood = moodFromHappy(newHappy);
  const newExtra = bumpDailyAfterInteract(writeNeeds(tapOutcome.extra, needsAfter), now, kind);

  const c = await updateCharacterAfterInteract(p.id, {
    now,
    xp: newXp,
    happy: newHappy,
    mood: newMood,
    level: newLevel,
    extra: newExtra,
  });
  if (!c) return null;
  return { ok: true, state: mapPayload(edgeId, platformUserId, p, c, now) };
}

/** Для задач: начислить XP после записи в edge_task_grants. */
export async function applyTaskXpToParticipant(
  participantId: string,
  xpDelta: number,
  now: Date,
): Promise<CharacterRow | null> {
  return incrementCharacterTaskXp(participantId, xpDelta, now);
}
