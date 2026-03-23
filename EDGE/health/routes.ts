import { Router } from "express";
import { getHealth } from "./handlers.js";

export function createHealthRouter(): Router {
  const r = Router();
  r.get("/health", (req, res, next) => void getHealth(req, res, next));
  return r;
}
