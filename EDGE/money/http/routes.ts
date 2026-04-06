import { Router } from "express";
import { requireEdgeServiceSecret } from "../../middleware/require-edge-secret.js";
import { requirePlatformUserHeader } from "../../middleware/require-platform-user.js";
import { getMoneyCampaignConfig } from "./handlers/get-campaign-config.js";
import { getMoneyInviteGrantsSum } from "./handlers/get-invite-grants-sum.js";
import { getMoneyChatAccrualTargets } from "./handlers/get-chat-accrual-targets.js";
import { getMoneyCallAccrualTargets } from "./handlers/get-call-accrual-targets.js";
import { getMoneyPostAccrualTargets } from "./handlers/get-post-accrual-targets.js";
import { getMoneyProfileLikeAccrualTargets } from "./handlers/get-profile-like-accrual-targets.js";
import { postMoneyPlatformEvent } from "./handlers/post-money-platform-event.js";
import { postMoneyStartTracking } from "./handlers/post-money-start-tracking.js";
import { getMoneyTrackingStarted } from "./handlers/get-money-tracking-started.js";
import { getMoneyParticipantSnippet } from "./handlers/get-money-participant-snippet.js";

export function createMoneyRouter(): Router {
  const r = Router();
  r.use(requireEdgeServiceSecret);
  r.get("/campaign-config", (req, res, next) => void getMoneyCampaignConfig(req, res, next));
  r.get("/invite-grants-sum", (req, res) => void getMoneyInviteGrantsSum(req, res));
  r.get("/chat-accrual-targets", (req, res) => void getMoneyChatAccrualTargets(req, res));
  r.get("/call-accrual-targets", (req, res) => void getMoneyCallAccrualTargets(req, res));
  r.get("/post-accrual-targets", (req, res) => void getMoneyPostAccrualTargets(req, res));
  r.get("/profile-like-accrual-targets", (req, res) => void getMoneyProfileLikeAccrualTargets(req, res));
  r.get("/tracking-started", (req, res) => void getMoneyTrackingStarted(req, res));
  r.get("/participant-snippet", (req, res) => void getMoneyParticipantSnippet(req, res));
  r.post(
    "/start-tracking",
    requirePlatformUserHeader,
    (req, res) => void postMoneyStartTracking(req, res),
  );
  r.post("/platform-events", (req, res) => void postMoneyPlatformEvent(req, res));
  return r;
}
