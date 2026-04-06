import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";

const bucket = new Map<string, { count: number; resetAt: number }>();

export function partnerRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const partnerId = req.partnerId ?? "unknown_partner";
  const key = `${partnerId}:${Math.floor(Date.now() / 60000)}`;
  const now = Date.now();
  const current = bucket.get(key) ?? { count: 0, resetAt: now + 60000 };
  current.count += 1;
  bucket.set(key, current);
  if (current.count > 1200) {
    throw new HttpError(429, "partner_rate_limit", "Partner rate limit exceeded");
  }
  next();
}

export function userRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const actor = req.sessionAuth?.pingUserId ?? "unknown_user";
  const key = `${actor}:${Math.floor(Date.now() / 60000)}`;
  const current = bucket.get(key) ?? { count: 0, resetAt: Date.now() + 60000 };
  current.count += 1;
  bucket.set(key, current);
  if (current.count > 600) {
    throw new HttpError(429, "user_rate_limit", "User rate limit exceeded");
  }
  next();
}
