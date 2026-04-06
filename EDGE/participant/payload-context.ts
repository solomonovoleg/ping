import { buildLifeSimulationPayload } from "./payload-life-simulation.js";
import { parseExtra } from "./participant-extra.js";
import { buildRecommendedAction } from "./payload-recommendation.js";
import { buildActionProgressPayload } from "./payload-action-progress.js";
import { buildCharacterStatusPayload } from "./payload-character-status.js";
import { buildPayloadEngagement } from "./payload-engagement.js";
import type { ParticipantStatePayload } from "./types.js";
import type { ParticipantStatusPart } from "./payload-types.js";

export type ParticipantPayloadContext = {
  characterStatus: ParticipantStatusPart;
  actionProgressPayload: ParticipantStatePayload["actionProgress"];
  introTapCount: number;
  recommendedAction: ParticipantStatePayload["recommendedAction"];
  lifeSimulation: ParticipantStatePayload["lifeSimulation"];
};

export function buildParticipantPayloadContext(
  characterExtraRaw: unknown,
  configJson: unknown,
  now: Date,
): ParticipantPayloadContext {
  const extra = parseExtra(characterExtraRaw);
  const characterStatus = buildCharacterStatusPayload(extra, now);
  const engagement = buildPayloadEngagement(extra, now);
  return {
    characterStatus,
    actionProgressPayload: buildActionProgressPayload(engagement.actionProgress),
    introTapCount: engagement.introTapCount,
    recommendedAction: buildRecommendedAction(
      extra,
      configJson,
      engagement.actionProgress,
      characterStatus.activeNeed,
    ),
    lifeSimulation: buildLifeSimulationPayload(extra, configJson, now),
  };
}
