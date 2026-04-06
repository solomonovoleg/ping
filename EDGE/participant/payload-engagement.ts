import { readActionProgress } from "./character-rules.js";
import { readIntroTapCount } from "./game-script-metrics.js";
import type { ActionProgress } from "./character-rules.js";

export function buildPayloadEngagement(extra: Record<string, unknown>, now: Date): {
  actionProgress: ActionProgress;
  introTapCount: number;
} {
  return {
    actionProgress: readActionProgress(extra),
    introTapCount: readIntroTapCount(extra, now),
  };
}
