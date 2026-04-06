import { applyLifeAfterAction } from "./service-helpers.js";
import { buildFeedCompletionState } from "./service-feed.js";

export function buildFeedCompletionUpdate(params: {
  tapExtra: Record<string, unknown>;
  careStreakDays: number;
  now: Date;
  baseXp: number;
  baseLevel: number;
  primaryBlocked: boolean;
  campaignConfigJson: unknown;
  prevMood: string;
}): {
  xp: number;
  happy: number;
  mood: "happy" | "neutral" | "sad";
  level: number;
  streak: number;
  extra: Record<string, unknown>;
} {
  const state = buildFeedCompletionState({
    tapExtra: params.tapExtra,
    careStreakDays: params.careStreakDays,
    now: params.now,
    baseXp: params.baseXp,
    baseLevel: params.baseLevel,
    primaryBlocked: params.primaryBlocked,
  });

  const extra = applyLifeAfterAction(
    state.extraWithMetrics,
    params.campaignConfigJson,
    params.now,
    params.prevMood,
    state.fedMood,
    "feed",
  );

  return {
    xp: state.newXp,
    happy: state.fedHappy,
    mood: state.fedMood,
    level: state.newLevel,
    streak: state.streak,
    extra,
  };
}
