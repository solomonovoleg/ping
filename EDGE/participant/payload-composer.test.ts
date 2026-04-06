import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import { composeParticipantStatePayload } from "./payload-composer.js";
import {
  makeActionProgressFixture,
  makeCoreFixture,
  makeLifeSimulationFixture,
  makeStatusFixture,
  makeTimeFixture,
} from "./payload-test-fixtures.js";

describe("payload-composer", () => {
  it("composes full participant payload from parts", () => {
    const out = composeParticipantStatePayload({
      edgeId: "edge-1",
      platformUserId: "u1",
      core: makeCoreFixture(),
      time: makeTimeFixture(),
      status: makeStatusFixture(),
      recommendedAction: "play",
      actionProgress: makeActionProgressFixture(),
      introTapCount: 11,
      lifeSimulation: makeLifeSimulationFixture(),
    });
    assert.equal(out.edgeId, "edge-1");
    assert.equal(out.platformUserId, "u1");
    assert.equal(out.recommendedAction, "play");
    assert.equal(out.actionProgress.target, EDGE_ACTION_TAP_TARGET);
    assert.equal(out.introTapCount, 11);
    assert.equal(out.lifeSimulation.enabled, false);
    assert.deepEqual(out.taskGrants, []);
    assert.deepEqual(out.taskProgress, []);
    assert.deepEqual(out.taskQuestSummary, {
      presetTotal: 0,
      objectiveTotal: 0,
      completedObjective: 0,
      edgeIncomplete: 0,
      edgeReadyToClaim: 0,
      platformOpen: 0,
      blockedConfig: 0,
    });
  });

  it("does not mutate compose input parts", () => {
    const core = makeCoreFixture({
      level: 4,
      xp: 333,
      primaryXp: 200,
      secondaryXp: 133,
      mood: "neutral",
      happyScore: 62,
      careStreakDays: 6,
    });
    const time = makeTimeFixture({
      lastFedAt: "2026-03-26T08:00:00.000Z",
      lastInteractionAt: "2026-03-26T09:00:00.000Z",
      careDeadlineAt: "2026-03-26T16:00:00.000Z",
    });
    const status = makeStatusFixture({
      gameScriptMetrics: {
        gameDailyYmd: "2026-03-26",
        gameLoginStreakDays: 6,
        dailyTapCount: 2,
        dailyFeedCount: 2,
        dailyPlayCount: 1,
        dailyToiletCount: 0,
        dailyCalmCount: 0,
        dailyPetCount: 3,
      },
      petNeeds: { hunger: 66, hygiene: 68, energy: 70, comfort: 72 },
    });
    const actionProgress = makeActionProgressFixture({ feed: 1, toilet: 1, play: 0 });
    const lifeSimulation = makeLifeSimulationFixture();

    const coreSnapshot = { ...core };
    const timeSnapshot = { ...time };
    const statusSnapshot = structuredClone(status);
    const progressSnapshot = { ...actionProgress };
    const lifeSnapshot = { ...lifeSimulation };

    const out = composeParticipantStatePayload({
      edgeId: "edge-immut",
      platformUserId: "u-immut",
      core,
      time,
      status,
      recommendedAction: "feed",
      actionProgress,
      introTapCount: 5,
      lifeSimulation,
    });

    assert.deepEqual(core, coreSnapshot);
    assert.deepEqual(time, timeSnapshot);
    assert.deepEqual(status, statusSnapshot);
    assert.deepEqual(actionProgress, progressSnapshot);
    assert.deepEqual(lifeSimulation, lifeSnapshot);
    assert.equal(out.edgeId, "edge-immut");
    assert.equal(out.platformUserId, "u-immut");
  });
});
