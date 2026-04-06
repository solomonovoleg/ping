import type { Request } from "express";

/** `postId` из `req.params` (Express может отдать строку или массив). */
export function postsRoutePostId(req: Request): string | undefined {
  const raw = req.params.postId;
  return Array.isArray(raw) ? raw[0] : raw;
}
