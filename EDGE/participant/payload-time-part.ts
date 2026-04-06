import { buildCareAndJoinedTimestamps } from "./payload-timestamps.js";
import { buildCharacterTimestamps } from "./payload-character-timestamps.js";
import type { CharacterRow, ParticipantRow } from "./db-types.js";
import type { ParticipantTimePart } from "./payload-types.js";

export function buildParticipantTimePart(
  participant: ParticipantRow,
  character: CharacterRow,
  now: Date,
): ParticipantTimePart {
  const timing = buildCareAndJoinedTimestamps(participant, character, now);
  const characterTimestamps = buildCharacterTimestamps(character);
  return {
    lastFedAt: characterTimestamps.lastFedAt,
    lastInteractionAt: characterTimestamps.lastInteractionAt,
    joinedAt: timing.joinedAt,
    careDeadlineAt: timing.careDeadlineAt,
  };
}
