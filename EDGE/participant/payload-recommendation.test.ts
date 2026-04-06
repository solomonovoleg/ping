import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRecommendedAction } from "./payload-recommendation.js";

describe("payload-recommendation", () => {
  it("prefers action progress over life recommendation", () => {
    const out = buildRecommendedAction(
      { lifeNeedQueue: [{ id: "q1", kind: "calm", spawnedAt: "2026-03-25T08:00:00.000Z", penalized: false }] },
      { companion: { lifeSimulation: { enabled: true } } },
      { feed: 2, toilet: 0, play: 0 },
      "anxious",
    );
    assert.equal(out, "feed");
  });

  it("uses life recommendation when progress is empty", () => {
    const out = buildRecommendedAction(
      { lifeNeedQueue: [{ id: "q1", kind: "play", spawnedAt: "2026-03-25T08:00:00.000Z", penalized: false }] },
      { companion: { lifeSimulation: { enabled: true } } },
      { feed: 0, toilet: 0, play: 0 },
      "hungry",
    );
    assert.equal(out, "play");
  });
});
