import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildParticipantComposeInput } from "./payload-input.js";
import { composeParticipantStatePayload } from "./payload-composer.js";
import {
  makeComposeContextFixture,
  makeCoreFixture,
  makeTimeFixture,
} from "./payload-test-fixtures.js";
import {
  PRESET_TASK_REF_KEY,
  buildTaskProgressLines,
  buildTaskQuestSummary,
} from "./payload-task-enrichment.js";
import type { TaskGrantRow } from "../tasks/grants-repo.js";

function samplePayload() {
  return composeParticipantStatePayload(
    buildParticipantComposeInput({
      edgeId: "edge-x",
      platformUserId: "user-x",
      core: makeCoreFixture({ level: 2, xp: 100, careStreakDays: 3 }),
      time: makeTimeFixture(),
      context: makeComposeContextFixture({
        characterStatus: {
          gameScriptMetrics: {
            gameDailyYmd: "2026-03-25",
            gameLoginStreakDays: 2,
            dailyTapCount: 3,
            dailyFeedCount: 1,
            dailyPlayCount: 0,
            dailyToiletCount: 0,
            dailyCalmCount: 0,
            dailyPetCount: 0,
          },
          petNeeds: { hunger: 50, hygiene: 50, energy: 50, comfort: 50 },
          activeNeed: null,
        },
      }),
    }),
  );
}

describe("payload-task-enrichment", () => {
  it("buildTaskProgressLines shows partial edge_game_daily_taps progress", () => {
    const payload = samplePayload();
    const config = {
      taskPresets: {
        game: [
          {
            key: "tap_mission",
            label: "Тапы",
            points: 12,
            penalty: 0,
            deadlineDays: 7,
            verify: { type: "edge_game_daily_taps", minCount: 10 },
          },
        ],
        global: [],
        commercial: [],
      },
    };
    const lines = buildTaskProgressLines(config, payload, []);
    assert.equal(lines.length, 1);
    const l = lines[0]!;
    assert.equal(l.taskKey, "tap_mission");
    assert.equal(l.claimed, false);
    assert.equal(l.tracking, "edge");
    assert.equal(l.current, 3);
    assert.equal(l.target, 10);
    assert.equal(l.satisfied, false);
    assert.equal(l.readyToClaim, false);
    assert.ok(l.ratio !== null && l.ratio < 1);
  });

  it("buildTaskProgressLines marks claimed preset with ratio 1", () => {
    const payload = samplePayload();
    const config = {
      taskPresets: {
        game: [
          {
            key: "tap_mission",
            label: "Тапы",
            points: 12,
            penalty: 0,
            deadlineDays: 7,
            verify: { type: "edge_game_daily_taps", minCount: 10 },
          },
        ],
        global: [],
        commercial: [],
      },
    };
    const grants: TaskGrantRow[] = [
      {
        task_key: "tap_mission",
        ref_key: PRESET_TASK_REF_KEY,
        xp_awarded: 12,
        created_at: new Date("2026-03-25T12:00:00.000Z"),
      },
    ];
    const lines = buildTaskProgressLines(config, payload, grants);
    assert.equal(lines[0]!.claimed, true);
    assert.equal(lines[0]!.ratio, 1);
    assert.equal(lines[0]!.readyToClaim, false);
    assert.equal(lines[0]!.xpAwardedIfClaimed, 12);
  });

  it("honor preset cannot be claimed (no objective server verify)", () => {
    const payload = samplePayload();
    const config = {
      taskPresets: {
        game: [
          {
            key: "honor_one",
            label: "Честное слово",
            points: 5,
            penalty: 0,
            deadlineDays: 7,
            verify: { type: "honor" },
          },
        ],
        global: [],
        commercial: [],
      },
    };
    const lines = buildTaskProgressLines(config, payload, []);
    assert.equal(lines[0]!.tracking, "honor");
    assert.equal(lines[0]!.readyToClaim, false);
    assert.equal(lines[0]!.satisfied, false);
    assert.equal(lines[0]!.ratio, null);
  });

  it("buildTaskQuestSummary counts edge incomplete and ready", () => {
    const payload = samplePayload();
    const config = {
      taskPresets: {
        game: [
          {
            key: "tap_mission",
            label: "Тапы",
            points: 12,
            penalty: 0,
            deadlineDays: 7,
            verify: { type: "edge_game_daily_taps", minCount: 10 },
          },
          {
            key: "honor_one",
            label: "X",
            points: 1,
            penalty: 0,
            deadlineDays: 7,
            verify: { type: "honor" },
          },
        ],
        global: [],
        commercial: [],
      },
    };
    const lines = buildTaskProgressLines(config, payload, []);
    const s = buildTaskQuestSummary(config, lines);
    assert.equal(s.presetTotal, 2);
    assert.equal(s.objectiveTotal, 1);
    assert.equal(s.blockedConfig, 1);
    assert.equal(s.completedObjective, 0);
    assert.equal(s.edgeIncomplete, 1);
    assert.equal(s.edgeReadyToClaim, 0);
  });
});
