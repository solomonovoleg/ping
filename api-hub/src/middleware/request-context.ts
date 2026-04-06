import type { NextFunction, Request, Response } from "express";
import { createId } from "../lib/ids.js";

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers["x-request-id"]?.toString() ?? createId("req");
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
