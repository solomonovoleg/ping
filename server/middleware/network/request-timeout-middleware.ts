import type { NextFunction, Request, Response } from "express";

const DEFAULT_API_TIMEOUT_MS = 20_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

const LONG_REQUEST_PATH_PREFIXES = ["/api/upload", "/api/call-transcripts/upload"];

function resolveApiTimeoutMs(): number {
  const raw = Number.parseInt(process.env.API_REQUEST_TIMEOUT_MS || "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_API_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, raw));
}

function resolveUploadTimeoutMs(): number {
  const raw = Number.parseInt(process.env.API_UPLOAD_TIMEOUT_MS || "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_UPLOAD_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(DEFAULT_API_TIMEOUT_MS, raw));
}

function resolveTimeoutMs(req: Request): number | null {
  if (!req.path.startsWith("/api")) return null;
  if (LONG_REQUEST_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return resolveUploadTimeoutMs();
  }
  return resolveApiTimeoutMs();
}

export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  const timeoutMs = resolveTimeoutMs(req);
  if (timeoutMs == null) {
    next();
    return;
  }
  let timeoutTriggered = false;
  let closedByClient = false;

  const completeWithTimeout = () => {
    if (timeoutTriggered || closedByClient || res.headersSent || res.writableEnded) return;
    timeoutTriggered = true;
    req.telemetryErrorDetail = "Request timeout";
    res.setHeader("X-Request-Timeout-Ms", String(timeoutMs));
    res.setHeader("Retry-After", "1");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Retryable", "1");
    res.status(504).json({
      message: "Сервер не успел обработать запрос. Проверьте интернет и попробуйте снова.",
      retryable: true,
      requestId: req.requestId ?? null,
      timestamp: new Date().toISOString(),
    });
  };

  const timer = setTimeout(completeWithTimeout, timeoutMs);
  const cleanup = () => {
    clearTimeout(timer);
    res.removeListener("finish", onFinish);
    res.removeListener("close", onClose);
    req.removeListener("aborted", onAborted);
  };

  const onFinish = () => cleanup();
  const onClose = () => cleanup();
  const onAborted = () => {
    closedByClient = true;
    req.telemetryErrorDetail = "Client aborted request";
    cleanup();
  };

  req.once("aborted", onAborted);
  res.once("finish", onFinish);
  res.once("close", onClose);
  res.setTimeout(timeoutMs + 1_000, completeWithTimeout);
  next();
}
