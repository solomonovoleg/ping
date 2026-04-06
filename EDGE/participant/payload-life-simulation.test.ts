import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLifeSimulationPayload } from "./payload-life-simulation.js";

describe("payload-life-simulation", () => {
  it("returns disabled payload when life simulation is off", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildLifeSimulationPayload({}, {}, now);
    assert.deepEqual(out, { enabled: false });
  });

  it("returns enabled payload with mapped queue when enabled", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildLifeSimulationPayload(
      {
        lifeRating: 300,
        lifeNeedQueue: [{ id: "q1", kind: "feed", spawnedAt: "2026-03-25T09:00:00.000Z", penalized: false }],
      },
      { companion: { lifeSimulation: { enabled: true } } },
      now,
    );
    assert.equal(out.enabled, true);
    if (out.enabled) {
      assert.equal(out.lifeRating, 300);
      assert.equal(out.needQueue.length, 1);
      assert.equal(out.needQueue[0]?.kind, "feed");
    }
  });
});
