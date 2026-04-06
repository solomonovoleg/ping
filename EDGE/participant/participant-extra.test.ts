import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseExtra } from "./participant-extra.js";

describe("participant-extra", () => {
  it("returns copy for plain object", () => {
    const src = { a: 1, b: "ok" };
    const out = parseExtra(src);
    assert.deepEqual(out, src);
    assert.equal(out === src, false);
  });

  it("returns empty object for non-objects", () => {
    assert.deepEqual(parseExtra(null), {});
    assert.deepEqual(parseExtra("x"), {});
    assert.deepEqual(parseExtra([1, 2]), {});
  });
});
