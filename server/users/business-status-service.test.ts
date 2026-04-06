import assert from "node:assert/strict";
import test from "node:test";
import {
  assessModerationTransition,
  canSubmitBusinessRequestByStatus,
  mapDecisionToBusinessStatus,
} from "./business-status-service";

test("canSubmitBusinessRequestByStatus allows only none/rejected/revision_required", () => {
  assert.equal(canSubmitBusinessRequestByStatus("none"), true);
  assert.equal(canSubmitBusinessRequestByStatus("rejected"), true);
  assert.equal(canSubmitBusinessRequestByStatus("revision_required"), true);
  assert.equal(canSubmitBusinessRequestByStatus("pending"), false);
  assert.equal(canSubmitBusinessRequestByStatus("approved"), false);
});

test("mapDecisionToBusinessStatus maps moderation decisions", () => {
  assert.equal(mapDecisionToBusinessStatus("approved"), "approved");
  assert.equal(mapDecisionToBusinessStatus("rejected"), "rejected");
  assert.equal(mapDecisionToBusinessStatus("revision_required"), "revision_required");
});

test("assessModerationTransition is idempotent for repeated same action", () => {
  assert.equal(assessModerationTransition("submitted", "approved"), "apply");
  assert.equal(assessModerationTransition("approved", "approved"), "idempotent");
  assert.equal(assessModerationTransition("rejected", "approved"), "conflict");
  assert.equal(assessModerationTransition("revision_required", "revision_required"), "idempotent");
});
