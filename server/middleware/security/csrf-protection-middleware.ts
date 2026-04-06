import type { Request, Response, NextFunction } from "express";
import { logSecurityAuditEvent } from "../../security/security-audit-log";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseAllowedOrigins(): Set<string> {
  const fromEnv = String(process.env.CSRF_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return new Set([
    ...fromEnv,
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "capacitor://localhost",
  ]);
}

function parseOriginFromReferer(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function shouldSkipCsrf(req: Request): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
  if (req.headers.authorization?.startsWith?.("Bearer ")) return true;
  return !req.session?.userId;
}

export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipCsrf(req)) {
    next();
    return;
  }

  const allowedOrigins = parseAllowedOrigins();
  const originHeader = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const refererOrigin = parseOriginFromReferer(typeof req.headers.referer === "string" ? req.headers.referer : undefined);
  const candidate = originHeader || refererOrigin || "";
  const ok = candidate.length > 0 && allowedOrigins.has(candidate);

  if (ok) {
    next();
    return;
  }

  const enforce = process.env.CSRF_ENFORCE === "1";
  logSecurityAuditEvent("csrf_origin_mismatch", {
    method: req.method,
    path: req.path,
    origin: originHeader || null,
    refererOrigin: refererOrigin || null,
    requestId: req.requestId ?? null,
    enforce,
  });
  if (enforce) {
    res.status(403).json({ message: "CSRF protection blocked this request" });
    return;
  }
  next();
}
