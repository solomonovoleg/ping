import type { Request, Response } from "express";
import { applyInviteRegisteredMoneyEvent } from "../../platform-events/apply-invite-registered-event.js";
import { applyChatMessagesMilestoneEvent } from "../../platform-events/apply-chat-messages-milestone.js";
import { applyVideoCallMinutesMilestoneEvent } from "../../platform-events/apply-video-call-minutes-milestone.js";
import { applyPostCreatedMilestoneEvent } from "../../platform-events/apply-post-created-milestone.js";
import { applyProfileLikesReceivedMilestoneEvent } from "../../platform-events/apply-profile-likes-received-milestone.js";
import { parseMoneyPlatformEventBody } from "../../platform-events/parse-platform-event-body.js";

export async function postMoneyPlatformEvent(req: Request, res: Response): Promise<void> {
  try {
    const body = parseMoneyPlatformEventBody(req.body);
    if (!body) {
      res.status(400).json({
        error: "invalid_body",
        hint:
          "invite_registered | chat_messages_milestone | video_call_minutes_milestone | post_created_milestone | profile_likes_received_milestone",
      });
      return;
    }
    if (body.type === "chat_messages_milestone") {
      const out = await applyChatMessagesMilestoneEvent({
        edgeId: body.edgeId,
        platformUserId: body.platformUserId,
        chatId: body.chatId,
        blockIndex: body.blockIndex,
      });
      if (!out) {
        res.status(500).json({ error: "apply_failed" });
        return;
      }
      if (out.awarded) {
        res.json({ ok: true, awarded: true, xpDelta: out.xpDelta });
        return;
      }
      res.json({ ok: true, awarded: false, reason: out.reason, xpDelta: 0 });
      return;
    }
    if (body.type === "video_call_minutes_milestone") {
      const out = await applyVideoCallMinutesMilestoneEvent({
        edgeId: body.edgeId,
        platformUserId: body.platformUserId,
        chatId: body.chatId,
        blockIndex: body.blockIndex,
      });
      if (!out) {
        res.status(500).json({ error: "apply_failed" });
        return;
      }
      if (out.awarded) {
        res.json({ ok: true, awarded: true, xpDelta: out.xpDelta });
        return;
      }
      res.json({ ok: true, awarded: false, reason: out.reason, xpDelta: 0 });
      return;
    }
    if (body.type === "post_created_milestone") {
      const out = await applyPostCreatedMilestoneEvent({
        edgeId: body.edgeId,
        platformUserId: body.platformUserId,
        blockIndex: body.blockIndex,
      });
      if (!out) {
        res.status(500).json({ error: "apply_failed" });
        return;
      }
      if (out.awarded) {
        res.json({ ok: true, awarded: true, xpDelta: out.xpDelta });
        return;
      }
      res.json({ ok: true, awarded: false, reason: out.reason, xpDelta: 0 });
      return;
    }
    if (body.type === "profile_likes_received_milestone") {
      const out = await applyProfileLikesReceivedMilestoneEvent({
        edgeId: body.edgeId,
        platformUserId: body.platformUserId,
        blockIndex: body.blockIndex,
      });
      if (!out) {
        res.status(500).json({ error: "apply_failed" });
        return;
      }
      if (out.awarded) {
        res.json({ ok: true, awarded: true, xpDelta: out.xpDelta });
        return;
      }
      res.json({ ok: true, awarded: false, reason: out.reason, xpDelta: 0 });
      return;
    }
    const out = await applyInviteRegisteredMoneyEvent({
      edgeId: body.edgeId,
      inviterPlatformUserId: body.inviterPlatformUserId,
      referralCodeId: body.referralCodeId,
    });
    if (!out) {
      res.status(500).json({ error: "apply_failed" });
      return;
    }
    if (out.awarded) {
      res.json({ ok: true, awarded: true, xpDelta: out.xpDelta });
      return;
    }
    res.json({ ok: true, awarded: false, reason: out.reason, xpDelta: 0 });
  } catch (e) {
    console.error("[edge/money/platform-events]", e);
    res.status(500).json({ error: "internal_error" });
  }
}
