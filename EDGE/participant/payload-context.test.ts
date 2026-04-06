import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import { buildParticipantPayloadContext } from "./payload-context.js";

describe("payload-context", () => {
  it("builds normalized context from raw extra", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildParticipantPayloadContext(
      {
        needs: { hunger: 20, hygiene: 80, energy: 80, comfort: 80 },
        actionProgress: { feed: 2, toilet: 0, play: 0 },
        edgeIntroTapCount: 7,
      },
      {},
      now,
    );
    assert.equal(out.characterStatus.activeNeed, "hungry");
    assert.equal(out.recommendedAction, "feed");
    assert.deepEqual(out.actionProgressPayload, {
      feed: 2,
      toilet: 0,
      play: 0,
      target: EDGE_ACTION_TAP_TARGET,
    });
    assert.equal(out.introTapCount, 7);
    assert.equal(out.lifeSimulation.enabled, false);
  });

  it("uses life queue recommendation when progress is empty", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildParticipantPayloadContext(
      {
        lifeNeedQueue: [{ id: "q1", kind: "play", spawnedAt: "2026-03-25T08:00:00.000Z", penalized: false }],
      },
      { companion: { lifeSimulation: { enabled: true } } },
      now,
    );
    assert.equal(out.recommendedAction, "play");
    assert.equal(out.lifeSimulation.enabled, true);
  });

  it("does not mutate raw character extra object", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const rawExtra = {
      needs: { hunger: 50, hygiene: 70, energy: 75, comfort: 72 },
      actionProgress: { feed: 0, toilet: 0, play: 0 },
      edgeIntroTapCount: 3,
    };
    const snapshot = structuredClone(rawExtra);
    buildParticipantPayloadContext(rawExtra, {}, now);
    assert.deepEqual(rawExtra, snapshot);
  });
});
