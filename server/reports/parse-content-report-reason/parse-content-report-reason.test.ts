import assert from "node:assert/strict";
import test from "node:test";
import { parseContentReportReason } from "./parse-content-report-reason";

test("parseContentReportReason: code + details for other", () => {
  const r = parseContentReportReason({ reasonCode: "other", reason: "   x y z  " });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.reasonCode, "other");
    assert.equal(r.value.reasonText, "x y z");
  }
});

test("parseContentReportReason: other without text fails", () => {
  const r = parseContentReportReason({ reasonCode: "other", reason: "" });
  assert.equal(r.ok, false);
});

test("parseContentReportReason: spam without extra text", () => {
  const r = parseContentReportReason({ reasonCode: "spam", reason: "" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.reasonCode, "spam");
    assert.equal(r.value.reasonText, "[spam]");
  }
});

test("parseContentReportReason: legacy reason only", () => {
  const r = parseContentReportReason({ reason: "hello world" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.reasonCode, null);
    assert.equal(r.value.reasonText, "hello world");
  }
});

test("parseContentReportReason: legacy too short", () => {
  const r = parseContentReportReason({ reason: "ab" });
  assert.equal(r.ok, false);
});
