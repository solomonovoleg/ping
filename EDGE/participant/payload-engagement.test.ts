import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPayloadEngagement } from "./payload-engagement.js";

describe("payload-engagement", () => {
  it("returns zeroed progress and intro count by default", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildPayloadEngagement({}, now);
    assert.deepEqual(out.actionProgress, { feed: 0, toilet: 0, play: 0 });
    assert.equal(out.introTapCount, 0);
  });

  it("reads progress and intro count from extra", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildPayloadEngagement(
      {
        actionProgress: { feed: 2, toilet: 1, play: 3 },
        edgeIntroTapCount: 11,
        gameDailyYmd: "2026-03-25",
      },
      now,
    );
    assert.deepEqual(out.actionProgress, { feed: 2, toilet: 1, play: 3 });
    assert.equal(out.introTapCount, 11);
  });
});
