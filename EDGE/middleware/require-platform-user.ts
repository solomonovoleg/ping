import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      edgePlatformUserId?: string;
    }
  }
}

/**
 * ID пользователя платформы передаёт только прокси ping-moot (после сессии).
 * Вместе с `requireEdgeServiceSecret` — не принимать запросы с интернета без секрета.
 */
export function requirePlatformUserHeader(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers["x-platform-user-id"];
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) {
    res.status(401).json({ error: "platform_user_required" });
    return;
  }
  req.edgePlatformUserId = id;
  next();
}
