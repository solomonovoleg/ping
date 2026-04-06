import type {
  ParticipantComposeContextInput,
  ParticipantComposeInput,
  ParticipantCorePart,
  ParticipantTimePart,
} from "./payload-types.js";

type BuildParticipantComposeInputParams = {
  edgeId: string;
  platformUserId: string;
  core: ParticipantCorePart;
  time: ParticipantTimePart;
  context: ParticipantComposeContextInput;
};

export function buildParticipantComposeInput(
  params: BuildParticipantComposeInputParams,
): ParticipantComposeInput {
  return {
    edgeId: params.edgeId,
    platformUserId: params.platformUserId,
    core: params.core,
    time: params.time,
    status: params.context.characterStatus,
    recommendedAction: params.context.recommendedAction,
    actionProgress: params.context.actionProgressPayload,
    introTapCount: params.context.introTapCount,
    lifeSimulation: params.context.lifeSimulation,
  };
}
