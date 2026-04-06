import { activeNeedFromNeeds, readNeeds } from "./character-rules.js";
import { readGameScriptMetrics } from "./game-script-metrics.js";
import type { ParticipantStatusPart } from "./payload-types.js";

export function buildCharacterStatusPayload(
  extra: Record<string, unknown>,
  now: Date,
): ParticipantStatusPart {
  const petNeeds = readNeeds(extra);
  return {
    gameScriptMetrics: readGameScriptMetrics(extra, now),
    petNeeds,
    activeNeed: activeNeedFromNeeds(petNeeds),
  };
}
