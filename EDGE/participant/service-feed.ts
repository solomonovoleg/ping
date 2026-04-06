import {
  applyNeedBonusByAction,
  computeStreakOnFeed,
  happyFromNeeds,
  moodFromHappy,
  readNeeds,
  writeNeeds,
  ymdUtc,
} from "./character-rules.js";
import { bumpDailyAfterFeed } from "./game-script-metrics.js";

export function buildFeedCompletionState(params: {
  tapExtra: Record<string, unknown>;
  careStreakDays: number;
  now: Date;
  baseXp: number;
  baseLevel: number;
  primaryBlocked: boolean;
}): {
  fedHappy: number;
  fedMood: "happy" | "neutral" | "sad";
  streak: number;
  extraWithMetrics: Record<string, unknown>;
  newXp: number;
  newLevel: number;
} {
  const fedNeeds = applyNeedBonusByAction(readNeeds(params.tapExtra), "feed");
  const fedHappy = happyFromNeeds(fedNeeds);
  const fedMood = moodFromHappy(fedHappy);
  const extraWithNeeds = writeNeeds(params.tapExtra, fedNeeds);
  const lastFedYmd = typeof extraWithNeeds.lastFedYmd === "string" ? extraWithNeeds.lastFedYmd : "";
  const streak = computeStreakOnFeed({
    careStreakDays: params.careStreakDays,
    lastFedYmd,
    now: params.now,
  });
  const extraWithMetrics = bumpDailyAfterFeed(
    { ...extraWithNeeds, lastFedYmd: ymdUtc(params.now) },
    params.now,
  );
  const newXp = params.primaryBlocked ? params.baseXp : params.baseXp + 10;
  const newLevel = params.primaryBlocked ? params.baseLevel : Math.floor(newXp / 100);

  return {
    fedHappy,
    fedMood,
    streak,
    extraWithMetrics,
    newXp,
    newLevel,
  };
}
