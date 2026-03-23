import { Router } from "express";
import { requireEdgeServiceSecret } from "../middleware/require-edge-secret.js";
import { getCampaignConfig } from "./handlers.js";

export function createCompanionRouter(): Router {
  const r = Router();
  r.use(requireEdgeServiceSecret);
  r.get("/campaign-config", (req, res, next) => void getCampaignConfig(req, res, next));
  return r;
}
