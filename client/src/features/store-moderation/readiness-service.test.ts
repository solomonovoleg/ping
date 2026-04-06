import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChecklistSummary,
  buildReleaseReadinessSnapshot,
  readStoredState,
} from "./readiness-service";

describe("readiness-service", () => {
  it("filters invalid keys and supports completedKeys format", () => {
    const raw = JSON.stringify({
      completedKeys: ["a", "x", 1],
      notesByKey: { a: "validated", x: "ignored" },
    });
    const state = readStoredState("k", ["a", "b"], raw);
    assert.deepEqual(state.completed, ["a"]);
    assert.equal(state.notesByKey.a, "validated");
  });

  it("returns empty state for invalid JSON", () => {
    const state = readStoredState("k", ["a"], "{bad json");
    assert.deepEqual(state, { completed: [], notesByKey: {} });
  });

  it("marks summary as not ready when notes are weak", () => {
    const summary = buildChecklistSummary(
      ["a", "b"],
      { completed: ["a", "b"], notesByKey: { a: "ok note", b: "x" } },
      3,
    );
    assert.equal(summary.done, 2);
    assert.equal(summary.total, 2);
    assert.equal(summary.ready, false);
  });

  it("builds overall readiness snapshot", () => {
    const apple = { done: 2, total: 2, percent: 100, ready: true };
    const play = { done: 1, total: 2, percent: 50, ready: false };
    const snapshot = buildReleaseReadinessSnapshot(apple, play);
    assert.equal(snapshot.overallDone, 3);
    assert.equal(snapshot.overallTotal, 4);
    assert.equal(snapshot.overallPercent, 75);
    assert.equal(snapshot.overallReady, false);
  });
});
