/**
 * Express middleware: замер длительности и передача в api-traffic-store на res.finish.
 */
import type { NextFunction, Request, Response } from "express";
import { recordApiTrafficFinish } from "./api-traffic-store";

import "./express-request";

export function apiTrafficModuleTelemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = (req.originalUrl || req.url || "").split("?")[0] || "";
  if (!path.startsWith("/api")) {
    next();
    return;
  }
  const start = Date.now();
  res.on("finish", () => {
    try {
      recordApiTrafficFinish(req, res, start);
    } catch {
      /* ignore */
    }
  });
  next();
}
