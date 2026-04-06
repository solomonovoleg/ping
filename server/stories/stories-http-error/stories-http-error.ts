import type { Response } from "express";
import { StoriesServiceError } from "../stories-service-error/stories-service-error";

export function sendStoriesRouteError(res: Response, e: unknown, fallbackMessage: string): void {
  if (e instanceof StoriesServiceError) {
    res.status(e.status).json({ message: e.message, code: "stories_error", retryable: e.status >= 500 });
    return;
  }
  const err = e as { status?: number; message?: string };
  if (typeof err?.status === "number" && typeof err?.message === "string") {
    res.status(err.status).json({ message: err.message, code: "stories_error", retryable: err.status >= 500 });
    return;
  }
  console.error("Stories route error:", e);
  res.status(500).json({ message: fallbackMessage, code: "stories_internal_error", retryable: true });
}
