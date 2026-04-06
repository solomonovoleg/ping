import type { CharacterRow } from "./db-types.js";
import type { ParticipantCorePart } from "./payload-types.js";

export function buildCharacterCorePayload(
  character: CharacterRow,
): ParticipantCorePart {
  return {
    level: character.level,
    xp: character.xp,
    primaryXp: character.primary_xp,
    secondaryXp: character.secondary_xp,
    mood: character.mood,
    happyScore: character.happy_score,
    careStreakDays: character.care_streak_days,
  };
}
