import type { ParticipantStatePayload } from "./types.js";
import type { ParticipantRow } from "./repo.js";
import { updateCharacterAfterInteract } from "./repo.js";
import { mapPayloadEnriched } from "./service-helpers.js";

export type PersistPartialProgressParams = {
  participantId: string;
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
};

export async function persistPartialProgress(
  params: PersistPartialProgressParams,
): Promise<ParticipantStatePayload | null> {
  const c = await updateCharacterAfterInteract(params.participantId, {
    now: params.now,
    xp: params.xp,
    happy: params.happy,
    mood: params.mood,
    level: params.level,
    extra: params.extra,
  });
  if (!c) return null;
  return mapPayloadEnriched(
    params.edgeId,
    params.platformUserId,
    params.participant,
    c,
    params.now,
    params.campaignConfigJson,
  );
}
