import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeLifeRecommended, pickRecommendedAction } from "./payload-recommended-action.js";

describe("payload-recommended-action", () => {
  it("normalizes only supported life actions", () => {
    assert.equal(normalizeLifeRecommended("feed"), "feed");
    assert.equal(normalizeLifeRecommended("calm"), "calm");
    assert.equal(normalizeLifeRecommended("tap"), null);
    assert.equal(normalizeLifeRecommended(null), null);
  });

  it("prioritizes in-progress feed/toilet/play over other signals", () => {
    const out = pickRecommendedAction({
      actionProgress: { feed: 1, toilet: 3, play: 2 },
      lifeRecommended: "calm",
      activeNeed: "anxious",
    });
    assert.equal(out, "feed");
  });

  it("uses life recommendation when progress is empty", () => {
    const out = pickRecommendedAction({
      actionProgress: { feed: 0, toilet: 0, play: 0 },
      lifeRecommended: "play",
      activeNeed: "hungry",
    });
    assert.equal(out, "play");
  });

  it("falls back to active need when no progress and no life recommendation", () => {
    const out = pickRecommendedAction({
      actionProgress: { feed: 0, toilet: 0, play: 0 },
      lifeRecommended: null,
      activeNeed: "dirty",
    });
    assert.equal(out, "toilet");
  });
});
