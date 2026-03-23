import { Router } from "express";
import { requireEdgeServiceSecret } from "../middleware/require-edge-secret.js";
import { requirePlatformUserHeader } from "../middleware/require-platform-user.js";
import {
  getCreatorCampaign,
  getMyCampaigns,
  patchCreatorCampaign,
  postCreateCampaign,
} from "./handlers.js";

export function createCreatorRouter(): Router {
  const r = Router();
  r.use(requireEdgeServiceSecret);
  r.use(requirePlatformUserHeader);
  r.get("/campaigns", (req, res, next) => void getMyCampaigns(req, res, next));
  r.post("/campaigns", (req, res, next) => void postCreateCampaign(req, res, next));
  r.get("/campaigns/:edgeId", (req, res, next) => void getCreatorCampaign(req, res, next));
  r.patch("/campaigns/:edgeId", (req, res, next) => void patchCreatorCampaign(req, res, next));
  return r;
}
