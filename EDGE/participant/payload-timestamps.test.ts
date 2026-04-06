import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCareAndJoinedTimestamps } from "./payload-timestamps.js";
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

function makeCharacter(lastFedAt: Date | null): CharacterRow {
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
    last_interaction_at: null,
    updated_at: new Date("2026-03-25T09:00:00.000Z"),
    extra: {},
  };
}

describe("payload-timestamps", () => {
  it("builds joinedAt from participant date and future care deadline", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildCareAndJoinedTimestamps(
      makeParticipant(new Date("2026-03-25T00:00:00.000Z")),
      makeCharacter(new Date("2026-03-25T06:30:00.000Z")),
      now,
    );
    assert.equal(out.joinedAt, "2026-03-25T00:00:00.000Z");
    assert.equal(out.careDeadlineAt, "2026-03-25T14:30:00.000Z");
  });

  it("returns null deadline when care is already overdue", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildCareAndJoinedTimestamps(
      makeParticipant(new Date("2026-03-24T00:00:00.000Z")),
      makeCharacter(new Date("2026-03-24T01:00:00.000Z")),
      now,
    );
    assert.equal(out.careDeadlineAt, null);
  });
});
