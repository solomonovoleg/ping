import {
  lifeQueueToPayload,
  parseLifeSimulationConfig,
  readLifeQueue,
  readLifeRating,
} from "./life-simulation.js";
import type { LifeSimulationStatePayload } from "./types.js";

export function buildLifeSimulationPayload(
  extra: Record<string, unknown>,
  configJson: unknown,
  now: Date,
): LifeSimulationStatePayload {
  const lifeCfg = parseLifeSimulationConfig(configJson);
  if (!lifeCfg.enabled) return { enabled: false };
  return {
    enabled: true,
    lifeRating: readLifeRating(extra, lifeCfg),
    lifeMin: lifeCfg.lifeMin,
    lifeMax: lifeCfg.lifeMax,
    needQueue: lifeQueueToPayload(readLifeQueue(extra), lifeCfg, now),
  };
}
