import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import { mapParticipantPayload } from "./payload.js";
import type { CharacterRow, ParticipantRow } from "./db-types.js";

describe("payload", () => {
  it("builds stable participant state from character and participant rows", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const participant: ParticipantRow = {
      id: "p1",
      campaign_public_id: "edge-1",
      platform_user_id: "u1",
      joined_at: new Date("2026-03-20T10:00:00.000Z"),
      money_tracking_started_at: null,
    };
    const character: CharacterRow = {
      participant_id: "p1",
      level: 3,
      xp: 220,
      primary_xp: 180,
      secondary_xp: 40,
      mood: "neutral",
      happy_score: 58,
      care_streak_days: 5,
      last_fed_at: new Date("2026-03-25T07:00:00.000Z"),
      last_interaction_at: new Date("2026-03-25T09:00:00.000Z"),
      updated_at: now,
      extra: {
        needs: { hunger: 55, hygiene: 60, energy: 62, comfort: 64 },
        actionProgress: { feed: 2, toilet: 0, play: 1 },
        edgeIntroTapCount: 9,
      },
    };

    const out = mapParticipantPayload("edge-1", "u1", participant, character, now, {});

    assert.equal(out.edgeId, "edge-1");
    assert.equal(out.platformUserId, "u1");
    assert.equal(out.level, 3);
    assert.equal(out.xp, 220);
    assert.equal(out.primaryXp, 180);
    assert.equal(out.secondaryXp, 40);
    assert.equal(out.careStreakDays, 5);
    assert.equal(out.lastFedAt, "2026-03-25T07:00:00.000Z");
    assert.equal(out.lastInteractionAt, "2026-03-25T09:00:00.000Z");
    assert.equal(out.joinedAt, "2026-03-20T10:00:00.000Z");
    assert.equal(out.careDeadlineAt, "2026-03-25T15:00:00.000Z");
    assert.equal(out.actionProgress.feed, 2);
    assert.equal(out.actionProgress.play, 1);
    assert.equal(out.actionProgress.target, EDGE_ACTION_TAP_TARGET);
    assert.equal(out.introTapCount, 9);
    assert.equal(out.lifeSimulation.enabled, false);
  });
});
