import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatVideoNoteDuration, nextVideoNotePlaybackRate } from "./playback-utils";

describe("video-note playback utils", () => {
  it("cycles playback rates in stable order", () => {
    assert.equal(nextVideoNotePlaybackRate(1), 1.5);
    assert.equal(nextVideoNotePlaybackRate(1.5), 2);
    assert.equal(nextVideoNotePlaybackRate(2), 1);
  });

  it("formats duration with mm:ss", () => {
    assert.equal(formatVideoNoteDuration(null), "0:00");
    assert.equal(formatVideoNoteDuration(0), "0:00");
    assert.equal(formatVideoNoteDuration(9), "0:09");
    assert.equal(formatVideoNoteDuration(61), "1:01");
  });
});
