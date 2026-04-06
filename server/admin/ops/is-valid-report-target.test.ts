import assert from "node:assert/strict";
import test from "node:test";
import { isValidReportTargetType } from "./is-valid-report-target";

test("isValidReportTargetType accepts comment", () => {
  assert.equal(isValidReportTargetType("comment"), true);
});

test("isValidReportTargetType accepts core UGC types", () => {
  for (const t of ["post", "user", "message", "story"] as const) {
    assert.equal(isValidReportTargetType(t), true);
  }
});

test("isValidReportTargetType rejects unknown", () => {
  assert.equal(isValidReportTargetType("reaction"), false);
  assert.equal(isValidReportTargetType(""), false);
});
