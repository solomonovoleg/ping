import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toIso } from "./participant-date.js";

describe("participant-date", () => {
  it("returns null for null input", () => {
    assert.equal(toIso(null), null);
  });

  it("returns ISO string for valid date", () => {
    assert.equal(toIso(new Date("2026-03-25T10:00:00.000Z")), "2026-03-25T10:00:00.000Z");
  });
});
