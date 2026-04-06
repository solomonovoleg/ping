import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { logSecurityAuditEvent } from "../../security/security-audit-log";

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function setupAbuseGuard(app: Express): void {
  if (process.env.RATE_LIMIT_DISABLED === "1") return;

  const uploadLimiter = rateLimit({
    windowMs: envNumber("RATE_LIMIT_UPLOAD_WINDOW_MS", 10 * 60 * 1000),
    max: envNumber("RATE_LIMIT_UPLOAD_MAX", 60),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Слишком много загрузок. Повторите позже." },
    handler: (req, res, _next, options) => {
      logSecurityAuditEvent("rate_limit_upload", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: req.requestId ?? null,
      });
      res.status(options.statusCode).json(options.message);
    },
  });

  app.use("/api/upload", uploadLimiter);

  const webhookLimiter = rateLimit({
    windowMs: envNumber("RATE_LIMIT_WEBHOOK_WINDOW_MS", 60 * 1000),
    max: envNumber("RATE_LIMIT_WEBHOOK_MAX", 120),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many webhook requests" },
    handler: (req, res, _next, options) => {
      logSecurityAuditEvent("rate_limit_webhook", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: req.requestId ?? null,
      });
      res.status(options.statusCode).json(options.message);
    },
  });

  app.use("/api/business-chat/webhook", webhookLimiter);
}
