import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import {
  isMessageSavedByUser,
  listSavedMessages,
  saveMessageForUser,
  SavedMessagesServiceError,
  unsaveMessageForUser,
} from "./service";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerSavedMessagesRoutes(app: Express): void {
  app.get("/api/saved-messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const list = await listSavedMessages(userId, limit, offset);
    res.json(list);
  });

  app.post("/api/saved-messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { messageId, chatId } = req.body ?? {};
    if (!messageId || typeof messageId !== "string" || !chatId || typeof chatId !== "string") {
      res.status(400).json({ message: "messageId и chatId обязательны" });
      return;
    }
    try {
      await saveMessageForUser(userId, messageId, chatId);
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof SavedMessagesServiceError) {
        if (error.code === "FORBIDDEN") {
          res.status(403).json({ message: error.message });
          return;
        }
        if (error.code === "NOT_FOUND") {
          res.status(404).json({ message: error.message });
          return;
        }
      }
      throw error;
    }
  });

  app.delete("/api/saved-messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const messageId = param(req.params, "messageId");
    await unsaveMessageForUser(userId, messageId);
    res.status(204).end();
  });

  app.get("/api/saved-messages/check/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const messageId = param(req.params, "messageId");
    const saved = await isMessageSavedByUser(userId, messageId);
    res.json({ saved });
  });
}
