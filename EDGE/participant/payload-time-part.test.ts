import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildParticipantTimePart } from "./payload-time-part.js";
import type { CharacterRow, ParticipantRow } from "./db-types.js";

function makeParticipant(joinedAt: Date): ParticipantRow {
  return {
    id: "p1",
    campaign_public_id: "edge-1",
    platform_user_id: "u1",
    joined_at: joinedAt,
    money_tracking_started_at: null,
  };
}

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

describe("payload-time-part", () => {
  it("combines care/joined and character timestamps", () => {
    const out = buildParticipantTimePart(
      makeParticipant(new Date("2026-03-25T00:00:00.000Z")),
      makeCharacter(new Date("2026-03-25T06:30:00.000Z"), new Date("2026-03-25T07:15:00.000Z")),
      new Date("2026-03-25T10:00:00.000Z"),
    );
    assert.equal(out.lastFedAt, "2026-03-25T06:30:00.000Z");
    assert.equal(out.lastInteractionAt, "2026-03-25T07:15:00.000Z");
    assert.equal(out.joinedAt, "2026-03-25T00:00:00.000Z");
    assert.equal(out.careDeadlineAt, "2026-03-25T14:30:00.000Z");
  });
});
