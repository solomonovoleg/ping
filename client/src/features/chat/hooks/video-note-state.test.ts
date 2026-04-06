import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getVideoNoteModalPhase,
  isVideoNoteRecordingStage,
  shouldShowVideoNoteModal,
  toLegacyVideoNoteState,
  withVideoNoteLock,
  type VideoNoteStage,
} from "./video-note-state";

describe("video-note-state", () => {
  it("maps recording stages correctly", () => {
    assert.equal(isVideoNoteRecordingStage("recording"), true);
    assert.equal(isVideoNoteRecordingStage("locked"), true);
    assert.equal(isVideoNoteRecordingStage("preview"), false);
  });

  it("returns modal phase only for recording or preview", () => {
    assert.equal(getVideoNoteModalPhase("recording"), "recording");
    assert.equal(getVideoNoteModalPhase("locked"), "recording");
    assert.equal(getVideoNoteModalPhase("preview"), "preview");
    assert.equal(getVideoNoteModalPhase("idle"), null);
  });

  it("converts stage to legacy tri-state", () => {
    const input: VideoNoteStage[] = ["idle", "holding", "recording", "locked", "preview", "sending", "error"];
    const legacy = input.map((x) => toLegacyVideoNoteState(x));
    assert.deepEqual(legacy, ["idle", "idle", "recording", "recording", "preview", "idle", "idle"]);
  });

  it("locks/unlocks only recording stages", () => {
    assert.equal(withVideoNoteLock("recording", true), "locked");
    assert.equal(withVideoNoteLock("locked", false), "recording");
    assert.equal(withVideoNoteLock("preview", true), "preview");
  });

  it("shows modal only for actionable stages", () => {
    assert.equal(shouldShowVideoNoteModal("recording"), true);
    assert.equal(shouldShowVideoNoteModal("locked"), true);
    assert.equal(shouldShowVideoNoteModal("preview"), true);
    assert.equal(shouldShowVideoNoteModal("idle"), false);
  });
});
