import { Router } from "express";
import { requireEdgeServiceSecret } from "../middleware/require-edge-secret.js";
import { requirePlatformUserHeader } from "../middleware/require-platform-user.js";
import {
  getCampaignLifeStatsHandler,
  getCreatorCampaign,
  getMyCampaigns,
  patchCreatorCampaign,
  postCreateCampaign,
  postCreatorPrizeDraw,
} from "./handlers.js";

export function createCreatorRouter(): Router {
  const r = Router();
  r.use(requireEdgeServiceSecret);
  r.use(requirePlatformUserHeader);
  r.get("/campaigns", (req, res, next) => void getMyCampaigns(req, res, next));
  r.post("/campaigns", (req, res, next) => void postCreateCampaign(req, res, next));
  r.get("/campaigns/:edgeId/life-stats", (req, res, next) => void getCampaignLifeStatsHandler(req, res, next));
  r.get("/campaigns/:edgeId", (req, res, next) => void getCreatorCampaign(req, res, next));
  r.patch("/campaigns/:edgeId", (req, res, next) => void patchCreatorCampaign(req, res, next));
  r.post("/campaigns/:edgeId/prize-draw", (req, res, next) => void postCreatorPrizeDraw(req, res, next));
  return r;
}
