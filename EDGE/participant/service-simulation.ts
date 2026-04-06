import { simulateNeedsToNow } from "./character-rules.js";
import { parseExtra } from "./participant-extra.js";

export function buildSimulationSnapshot(
  extraRaw: unknown,
  now: Date,
): ReturnType<typeof simulateNeedsToNow> {
  return simulateNeedsToNow(parseExtra(extraRaw), now);
}
