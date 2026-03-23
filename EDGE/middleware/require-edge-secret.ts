import type { Request, Response, NextFunction } from "express";
import { getServiceSecret } from "../config/env.js";

/**
 * Защита внутренних ручек: только платформа с секретом (или dev без секрета).
 */
export function requireEdgeServiceSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = getServiceSecret();
  if (!secret) {
    next();
    return;
  }
  const auth = req.headers.authorization;
  const raw = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const hdr = req.headers["x-edge-secret"];
  const fromHeader = typeof hdr === "string" ? hdr.trim() : "";
  const token = raw || fromHeader;
  if (token !== secret) {
    res.status(401).json({ error: "edge_unauthorized" });
    return;
  }
  next();
}
