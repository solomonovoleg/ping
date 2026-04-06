import { nextCareDeadlineIso } from "./character-rules.js";
import { toIso } from "./participant-date.js";
import type { CharacterRow, ParticipantRow } from "./db-types.js";
import type { ParticipantTimePart } from "./payload-types.js";

export function buildCareAndJoinedTimestamps(
  participant: ParticipantRow,
  character: CharacterRow,
  now: Date,
): Pick<ParticipantTimePart, "careDeadlineAt" | "joinedAt"> {
  return {
    careDeadlineAt: nextCareDeadlineIso(character.last_fed_at, participant.joined_at, now),
    joinedAt: toIso(participant.joined_at) ?? now.toISOString(),
  };
}
