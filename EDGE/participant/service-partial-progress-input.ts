import type { PersistPartialProgressParams } from "./service-partial-progress.js";
import type { ParticipantRow } from "./repo.js";

export function buildPartialProgressParams(params: {
  now: Date;
  edgeId: string;
  platformUserId: string;
  participant: ParticipantRow;
  campaignConfigJson: unknown;
  xp: number;
  happy: number;
  mood: string;
  level: number;
  extra: Record<string, unknown>;
}): PersistPartialProgressParams {
  return {
    participantId: params.participant.id,
    now: params.now,
    edgeId: params.edgeId,
    platformUserId: params.platformUserId,
    participant: params.participant,
    campaignConfigJson: params.campaignConfigJson,
    xp: params.xp,
    happy: params.happy,
    mood: params.mood,
    level: params.level,
    extra: params.extra,
  };
}
