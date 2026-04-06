import type { Request, RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
};

type UserHits = {
  hits: number[];
};

function getUserKey(req: Request): string | null {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (typeof userId === "string" && userId.trim()) return userId.trim();
  return null;
}

export function createUserSlidingRateLimit(opts: RateLimitOptions): RequestHandler {
  const hitsByUser = new Map<string, UserHits>();

  return (req, res, next) => {
    const userKey = getUserKey(req);
    if (!userKey) {
      next();
      return;
    }
    const now = Date.now();
    const windowStart = now - opts.windowMs;
    const state = hitsByUser.get(userKey) ?? { hits: [] };
    state.hits = state.hits.filter((ts) => ts > windowStart);
    if (state.hits.length >= opts.max) {
      res.status(429).json({ message: opts.message });
      return;
    }
    state.hits.push(now);
    hitsByUser.set(userKey, state);
    next();
  };
}
