import {
  applyNeedBonusByAction,
  happyFromNeeds,
  moodFromHappy,
  readNeeds,
  type InteractKind,
  writeNeeds,
} from "./character-rules.js";
import { bumpDailyAfterInteract, readGameScriptMetrics } from "./game-script-metrics.js";
import { baseInteractBonusXp, parsePrimaryTapBonusRule } from "./service-helpers.js";

export function buildInteractCompletionState(params: {
  kind: InteractKind;
  tapExtra: Record<string, unknown>;
  now: Date;
  campaignConfigJson: unknown;
  primaryBlocked: boolean;
  baseXp: number;
  baseLevel: number;
}): {
  newExtra: Record<string, unknown>;
  newXp: number;
  newLevel: number;
  newHappy: number;
  newMood: "happy" | "neutral" | "sad";
} {
  let bonusXp = baseInteractBonusXp(params.kind);
  const needsAfter = applyNeedBonusByAction(readNeeds(params.tapExtra), params.kind);
  const newExtra = bumpDailyAfterInteract(writeNeeds(params.tapExtra, needsAfter), params.now, params.kind);

  if (params.kind === "tap" && !params.primaryBlocked) {
    const rule = parsePrimaryTapBonusRule(params.campaignConfigJson);
    if (rule) {
      const gm = readGameScriptMetrics(newExtra, params.now);
      if (gm.dailyTapCount > 0 && gm.dailyTapCount % rule.tapsPerPoint === 0) {
        bonusXp += rule.points;
      }
    }
  }

  if (params.primaryBlocked) {
    bonusXp = 0;
  }

  const newXp = params.baseXp + bonusXp;
  const newLevel = Math.floor(newXp / 100);
  const newHappy = happyFromNeeds(needsAfter);
  const newMood = moodFromHappy(newHappy);

  return {
    newExtra,
    newXp,
    newLevel,
    newHappy,
    newMood,
  };
}
