import {
  applyInteractTapProgress,
  withInteractTimestamp,
  type InteractKind,
} from "./character-rules.js";
import { bumpIntroTapCount } from "./game-script-metrics.js";

export function applyInteractTapOutcome(
  extra: Record<string, unknown>,
  kind: InteractKind,
  now: Date,
): { extra: Record<string, unknown>; progress: { play: number; toilet: number }; completed: boolean } {
  let stepped = withInteractTimestamp(extra, kind, now);
  if (kind === "tap") stepped = bumpIntroTapCount(stepped, now);
  return applyInteractTapProgress(stepped, kind);
}
