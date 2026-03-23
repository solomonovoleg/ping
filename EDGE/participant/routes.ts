import { Router } from "express";
import { requireEdgeServiceSecret } from "../middleware/require-edge-secret.js";
import { requirePlatformUserHeader } from "../middleware/require-platform-user.js";
import { getLeaderboard, getState, postFeed, postInteract } from "./handlers.js";
import { postTaskReward } from "../tasks/post-task-handler.js";
import { postFollowReward } from "../follow-reward/post-follow-reward-handler.js";

export function createParticipantRouter(): Router {
  const r = Router();
  r.use(requireEdgeServiceSecret);
  r.use(requirePlatformUserHeader);
  r.get("/state", (req, res, next) => void getState(req, res, next));
  r.get("/leaderboard", (req, res, next) => void getLeaderboard(req, res, next));
  r.post("/feed", (req, res, next) => void postFeed(req, res, next));
  r.post("/interact", (req, res, next) => void postInteract(req, res, next));
  r.post("/task", (req, res, next) => void postTaskReward(req, res, next));
  r.post("/follow-reward", (req, res, next) => void postFollowReward(req, res, next));
  return r;
}
