import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import { buildParticipantComposeInput } from "./payload-input.js";
import {
  makeActionProgressFixture,
  makeComposeContextFixture,
  makeCoreFixture,
  makeLifeSimulationFixture,
  makeStatusFixture,
  makeTimeFixture,
} from "./payload-test-fixtures.js";

describe("payload-input", () => {
  it("builds composer input from prepared parts", () => {
    const out = buildParticipantComposeInput({
      edgeId: "edge-1",
      platformUserId: "platform-1",
      core: makeCoreFixture({ xp: 210, primaryXp: 120, secondaryXp: 90, happyScore: 78, careStreakDays: 5 }),
      time: makeTimeFixture({
        lastInteractionAt: "2026-03-25T08:30:00.000Z",
        joinedAt: "2026-03-20T08:00:00.000Z",
        careDeadlineAt: "2026-03-25T12:00:00.000Z",
      }),
      context: makeComposeContextFixture({
        characterStatus: makeStatusFixture({
          petNeeds: { hunger: 70, hygiene: 80, energy: 85, comfort: 90 },
        }),
        actionProgressPayload: makeActionProgressFixture({ feed: 0, toilet: 0, play: 1 }),
      }),
    });

    assert.equal(out.edgeId, "edge-1");
    assert.equal(out.platformUserId, "platform-1");
    assert.equal(out.status.activeNeed, null);
    assert.equal(out.recommendedAction, "play");
    assert.deepEqual(out.actionProgress, { feed: 0, toilet: 0, play: 1, target: EDGE_ACTION_TAP_TARGET });
    assert.equal(out.introTapCount, 4);
    assert.deepEqual(out.lifeSimulation, { enabled: false });
  });

  it("does not mutate input parts", () => {
    const core = makeCoreFixture({
      level: 7,
      xp: 999,
      primaryXp: 700,
      secondaryXp: 299,
      mood: "neutral",
      happyScore: 61,
      careStreakDays: 10,
    });
    const time = makeTimeFixture({
      lastFedAt: "2026-03-26T08:00:00.000Z",
      lastInteractionAt: "2026-03-26T08:30:00.000Z",
      joinedAt: "2026-03-20T08:00:00.000Z",
      careDeadlineAt: "2026-03-26T12:00:00.000Z",
    });
    const context = makeComposeContextFixture({
      characterStatus: makeStatusFixture({
        gameScriptMetrics: {
          gameDailyYmd: "2026-03-26",
          gameLoginStreakDays: 6,
          dailyTapCount: 1,
          dailyFeedCount: 2,
          dailyPlayCount: 1,
          dailyToiletCount: 0,
          dailyCalmCount: 0,
          dailyPetCount: 3,
        },
        petNeeds: { hunger: 66, hygiene: 70, energy: 74, comfort: 78 },
      }),
      recommendedAction: "feed",
      actionProgressPayload: makeActionProgressFixture({ feed: 1, toilet: 0, play: 0 }),
      introTapCount: 2,
      lifeSimulation: makeLifeSimulationFixture(),
    });

    const coreSnapshot = { ...core };
    const timeSnapshot = { ...time };
    const contextSnapshot = structuredClone(context);

    const out = buildParticipantComposeInput({
      edgeId: "edge-immut",
      platformUserId: "platform-immut",
      core,
      time,
      context,
    });

    assert.deepEqual(core, coreSnapshot);
    assert.deepEqual(time, timeSnapshot);
    assert.deepEqual(context, contextSnapshot);
    assert.equal(out.edgeId, "edge-immut");
    assert.equal(out.platformUserId, "platform-immut");
    assert.equal(out.recommendedAction, "feed");
  });
});
