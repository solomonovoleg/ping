import type { NextFunction, Request, Response } from "express";

export function apiNotFoundMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }
  if (res.headersSent || res.writableEnded) {
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Retryable", "0");
  res.status(404).json({
    message: "Метод или маршрут API не найден.",
    retryable: false,
    requestId: req.requestId ?? null,
    timestamp: new Date().toISOString(),
  });
}
