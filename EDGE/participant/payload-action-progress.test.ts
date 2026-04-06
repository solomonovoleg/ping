import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import { buildActionProgressPayload } from "./payload-action-progress.js";

describe("payload-action-progress", () => {
  it("maps action progress and appends target", () => {
    const out = buildActionProgressPayload({ feed: 1, toilet: 2, play: 3 });
    assert.equal(out.feed, 1);
    assert.equal(out.toilet, 2);
    assert.equal(out.play, 3);
    assert.equal(out.target, EDGE_ACTION_TAP_TARGET);
  });

  it("does not mutate input progress object", () => {
    const input = { feed: 4, toilet: 5, play: 6 };
    const inputSnapshot = { ...input };
    const out = buildActionProgressPayload(input);

    assert.deepEqual(input, inputSnapshot);
    assert.notEqual(out, input);
  });
});
