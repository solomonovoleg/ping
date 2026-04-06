import type { NextFunction, Request, Response } from "express";
import { isRetryableStatus } from "./is-retryable-status";

type ErrorWithStatus = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

const DEFAULT_ERROR_MESSAGE = "Internal Server Error";

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const sourceError = (err instanceof Error ? err : new Error(DEFAULT_ERROR_MESSAGE)) as ErrorWithStatus;
  const computedStatus = sourceError.status || sourceError.statusCode || 500;
  const status = Number.isInteger(computedStatus) && computedStatus >= 400 && computedStatus <= 599 ? computedStatus : 500;
  const isInvalidJsonPayload = sourceError instanceof SyntaxError && sourceError.type === "entity.parse.failed";
  const normalizedStatus = isInvalidJsonPayload ? 400 : status;
  const message =
    isInvalidJsonPayload
      ? "Некорректный JSON в теле запроса."
      : typeof sourceError.message === "string" && sourceError.message.trim().length > 0
      ? sourceError.message
      : DEFAULT_ERROR_MESSAGE;
  const retryable = isRetryableStatus(normalizedStatus);

  console.error("Internal Server Error:", sourceError);

  if (res.headersSent) {
    return next(sourceError);
  }

  if (message.length > 0) {
    req.telemetryErrorDetail = message.slice(0, 500);
  }

  if (retryable && !res.getHeader("Retry-After")) {
    res.setHeader("Retry-After", "1");
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Retryable", retryable ? "1" : "0");

  return res.status(normalizedStatus).json({
    message,
    retryable,
    requestId: req.requestId ?? null,
    timestamp: new Date().toISOString(),
  });
}
