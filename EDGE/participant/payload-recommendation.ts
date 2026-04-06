import { parseLifeSimulationConfig, peekFirstLifeQueueAction } from "./life-simulation.js";
import { normalizeLifeRecommended, pickRecommendedAction } from "./payload-recommended-action.js";
import type { ActiveNeed, ActionProgress } from "./character-rules.js";
import type { ParticipantStatePayload } from "./types.js";

export function buildRecommendedAction(
  extra: Record<string, unknown>,
  configJson: unknown,
  actionProgress: ActionProgress,
  activeNeed: ActiveNeed,
): ParticipantStatePayload["recommendedAction"] {
  const lifeCfg = parseLifeSimulationConfig(configJson);
  const lifePick = peekFirstLifeQueueAction(extra, lifeCfg);
  const lifeRecommended = normalizeLifeRecommended(lifePick);
  return pickRecommendedAction({
    actionProgress,
    lifeRecommended,
    activeNeed,
  });
}
