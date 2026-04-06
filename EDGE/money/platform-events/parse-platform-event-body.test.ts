import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMoneyPlatformEventBody } from "./parse-platform-event-body.js";

describe("parseMoneyPlatformEventBody", () => {
  it("parses chat_messages_milestone", () => {
    const b = parseMoneyPlatformEventBody({
      type: "chat_messages_milestone",
      edgeId: "e1",
      platformUserId: "u1",
      chatId: "c1",
      blockIndex: 2,
    });
    assert.equal(b?.type, "chat_messages_milestone");
    if (b?.type === "chat_messages_milestone") {
      assert.equal(b.edgeId, "e1");
      assert.equal(b.blockIndex, 2);
    }
  });

  it("parses invite_registered", () => {
    const b = parseMoneyPlatformEventBody({
      type: "invite_registered",
      edgeId: "e",
      inviterPlatformUserId: "a",
      referralCodeId: "r",
    });
    assert.equal(b?.type, "invite_registered");
  });

  it("rejects invalid milestone", () => {
    assert.equal(parseMoneyPlatformEventBody({ type: "chat_messages_milestone", edgeId: "e" }), null);
  });

  it("parses video_call_minutes_milestone", () => {
    const b = parseMoneyPlatformEventBody({
      type: "video_call_minutes_milestone",
      edgeId: "e1",
      platformUserId: "u1",
      chatId: "c1",
      blockIndex: 3,
    });
    assert.equal(b?.type, "video_call_minutes_milestone");
  });
});
