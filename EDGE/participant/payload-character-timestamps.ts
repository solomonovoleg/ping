import { toIso } from "./participant-date.js";
import type { CharacterRow } from "./db-types.js";
import type { ParticipantTimePart } from "./payload-types.js";

export function buildCharacterTimestamps(
  character: CharacterRow,
): Pick<ParticipantTimePart, "lastFedAt" | "lastInteractionAt"> {
  return {
    lastFedAt: toIso(character.last_fed_at),
    lastInteractionAt: toIso(character.last_interaction_at),
  };
}
