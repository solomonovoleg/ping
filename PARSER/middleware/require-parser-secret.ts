import type { Request, Response, NextFunction } from "express";
import { getServiceSecret, isNodeProduction } from "../config/env.js";

/**
 * Внутренние ручки /v1/* (кроме health): в production без PARSER_SERVICE_SECRET — 503;
 * в dev без секрета — пропуск (удобно локально).
 */
export function requireParserServiceSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = getServiceSecret();
  if (!secret) {
    if (isNodeProduction()) {
      res.status(503).json({ error: "parser_secret_not_configured" });
      return;
    }
    next();
    return;
  }
  const auth = req.headers.authorization;
  const raw = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const hdr = req.headers["x-parser-secret"];
  const fromHeader = typeof hdr === "string" ? hdr.trim() : "";
  const token = raw || fromHeader;
  if (token !== secret) {
    res.status(401).json({ error: "parser_unauthorized" });
    return;
  }
  next();
}
