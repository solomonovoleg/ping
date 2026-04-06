import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCharacterStatusPayload } from "./payload-character-status.js";

describe("payload-character-status", () => {
  it("returns default metrics and no active need for healthy defaults", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildCharacterStatusPayload({}, now);
    assert.equal(out.petNeeds.hunger, 72);
    assert.equal(out.petNeeds.hygiene, 72);
    assert.equal(out.petNeeds.energy, 72);
    assert.equal(out.petNeeds.comfort, 72);
    assert.equal(out.activeNeed, null);
    assert.equal(out.gameScriptMetrics.gameDailyYmd, "2026-03-25");
  });

  it("detects active need from low hunger", () => {
    const now = new Date("2026-03-25T10:00:00.000Z");
    const out = buildCharacterStatusPayload(
      { needs: { hunger: 20, hygiene: 80, energy: 80, comfort: 80 } },
      now,
    );
    assert.equal(out.activeNeed, "hungry");
  });
});
