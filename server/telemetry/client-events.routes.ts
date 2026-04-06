import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import {
  recordIseeTimeToFirstPlayClientEvent,
  recordTablePasteFallbackClientEvent,
} from "../admin/telemetry/client-events-store";

type ClientEventBody = {
  name?: unknown;
  payload?: unknown;
};

export function registerClientTelemetryRoutes(app: Express): void {
  app.post("/api/telemetry/client-event", requireAuth, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as ClientEventBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const payload =
      body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};

    if (name === "chat.table_paste_fallback") {
      const ok = recordTablePasteFallbackClientEvent({
        event: String(payload.event ?? ""),
        chatId: payload.chatId,
        cols: payload.cols,
        rows: payload.rows,
        viaRetry: payload.viaRetry,
        userId,
      });
      if (!ok) {
        res.status(400).json({ message: "Invalid telemetry payload" });
        return;
      }
      res.status(204).end();
      return;
    }

    if (name === "isee.time_to_first_play") {
      const ok = recordIseeTimeToFirstPlayClientEvent({
        userId,
        ms: payload.ms,
        postId: payload.postId,
        connectionType: payload.connectionType,
      });
      if (!ok) {
        res.status(400).json({ message: "Invalid telemetry payload" });
        return;
      }
      res.status(204).end();
      return;
    }

    res.status(400).json({ message: "Unsupported telemetry event" });
  });
}
