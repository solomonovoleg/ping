import { Router } from "express";
import { requireEdgeServiceSecret } from "../middleware/require-edge-secret.js";
import { postDraw } from "./handlers.js";
import { postCompanionConfig } from "./post-companion-config-handler.js";

export function createCampaignRouter(): Router {
  const r = Router();
  r.use(requireEdgeServiceSecret);
  r.post("/draw", (req, res, next) => void postDraw(req, res, next));
  r.post("/companion-config", (req, res, next) => void postCompanionConfig(req, res, next));
  return r;
}
