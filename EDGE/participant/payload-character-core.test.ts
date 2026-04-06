import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCharacterCorePayload } from "./payload-character-core.js";
import type { CharacterRow } from "./db-types.js";

function makeCharacter(): CharacterRow {
  return {
    participant_id: "p1",
    level: 3,
    xp: 140,
    primary_xp: 110,
    secondary_xp: 30,
    mood: "happy",
    happy_score: 77,
    care_streak_days: 4,
    last_fed_at: null,
    last_interaction_at: null,
    updated_at: new Date("2026-03-25T09:00:00.000Z"),
    extra: {},
  };
}

describe("payload-character-core", () => {
  it("maps core character fields to payload shape", () => {
    const out = buildCharacterCorePayload(makeCharacter());
    assert.equal(out.level, 3);
    assert.equal(out.xp, 140);
    assert.equal(out.primaryXp, 110);
    assert.equal(out.secondaryXp, 30);
    assert.equal(out.mood, "happy");
    assert.equal(out.happyScore, 77);
    assert.equal(out.careStreakDays, 4);
  });
});
