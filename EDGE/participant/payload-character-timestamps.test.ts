import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCharacterTimestamps } from "./payload-character-timestamps.js";
import type { CharacterRow } from "./db-types.js";

function makeCharacter(lastFedAt: Date | null, lastInteractionAt: Date | null): CharacterRow {
  return {
    participant_id: "p1",
    level: 1,
    xp: 0,
    primary_xp: 0,
    secondary_xp: 0,
    mood: "neutral",
    happy_score: 50,
    care_streak_days: 1,
    last_fed_at: lastFedAt,
    last_interaction_at: lastInteractionAt,
    updated_at: new Date("2026-03-25T09:00:00.000Z"),
    extra: {},
  };
}

describe("payload-character-timestamps", () => {
  it("maps both timestamps to ISO strings", () => {
    const out = buildCharacterTimestamps(
      makeCharacter(
        new Date("2026-03-25T06:00:00.000Z"),
        new Date("2026-03-25T07:00:00.000Z"),
      ),
    );
    assert.equal(out.lastFedAt, "2026-03-25T06:00:00.000Z");
    assert.equal(out.lastInteractionAt, "2026-03-25T07:00:00.000Z");
  });

  it("keeps null values when timestamps are absent", () => {
    const out = buildCharacterTimestamps(makeCharacter(null, null));
    assert.equal(out.lastFedAt, null);
    assert.equal(out.lastInteractionAt, null);
  });
});
