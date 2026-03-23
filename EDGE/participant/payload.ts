import { activeNeedFromNeeds, EDGE_ACTION_TAP_TARGET, nextCareDeadlineIso, readActionProgress, readNeeds } from "./character-rules.js";
import { readGameScriptMetrics } from "./game-script-metrics.js";
import type { ParticipantStatePayload } from "./types.js";
import type { CharacterRow, ParticipantRow } from "./db-types.js";

export function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

export function parseExtra(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function mapParticipantPayload(
  edgeId: string,
  platformUserId: string,
  p: ParticipantRow,
  c: CharacterRow,
  now: Date,
): ParticipantStatePayload {
  const careDeadlineAt = nextCareDeadlineIso(c.last_fed_at, p.joined_at, now);
  const extra = parseExtra(c.extra);
  const gameScriptMetrics = readGameScriptMetrics(extra, now);
  const petNeeds = readNeeds(extra);
  const actionProgress = readActionProgress(extra);
  const activeNeed = activeNeedFromNeeds(petNeeds);
  const recommendedAction =
    actionProgress.feed > 0
      ? "feed"
      : actionProgress.toilet > 0
        ? "toilet"
        : actionProgress.play > 0
          ? "play"
          : activeNeed === "hungry"
            ? "feed"
            : activeNeed === "dirty"
              ? "toilet"
              : activeNeed === "bored"
                ? "play"
                : activeNeed === "anxious"
                  ? "calm"
                  : null;
  return {
    edgeId,
    platformUserId,
    level: c.level,
    xp: c.xp,
    mood: c.mood,
    happyScore: c.happy_score,
    careStreakDays: c.care_streak_days,
    lastFedAt: toIso(c.last_fed_at),
    lastInteractionAt: toIso(c.last_interaction_at),
    joinedAt: toIso(p.joined_at) ?? new Date().toISOString(),
    careDeadlineAt,
    gameScriptMetrics,
    petNeeds,
    activeNeed,
    recommendedAction,
    actionProgress: {
      ...actionProgress,
      target: EDGE_ACTION_TAP_TARGET,
    },
  };
}
