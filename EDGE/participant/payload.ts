import { buildCharacterCorePayload } from "./payload-character-core.js";
import { buildParticipantPayloadContext } from "./payload-context.js";
import { composeParticipantStatePayload } from "./payload-composer.js";
import { buildParticipantComposeInput } from "./payload-input.js";
import { buildParticipantTimePart } from "./payload-time-part.js";
import type { ParticipantStatePayload } from "./types.js";
import type { CharacterRow, ParticipantRow } from "./db-types.js";

export function mapParticipantPayload(
  edgeId: string,
  platformUserId: string,
  p: ParticipantRow,
  c: CharacterRow,
  now: Date,
  configJson: unknown,
): ParticipantStatePayload {
  const characterCore = buildCharacterCorePayload(c);
  const timePart = buildParticipantTimePart(p, c, now);
  const context = buildParticipantPayloadContext(c.extra, configJson, now);
  return composeParticipantStatePayload(
    buildParticipantComposeInput({
      edgeId,
      platformUserId,
      core: characterCore,
      time: timePart,
      context,
    }),
  );
}
