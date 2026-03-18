import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, getUserId } from "../auth/session";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerSavedMessagesRoutes(app: Express): void {
  app.get("/api/saved-messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const list = await storage.listSavedMessages(userId, limit, offset);
    res.json(list.map((r) => ({ ...r, savedAt: r.savedAt.toISOString() })));
  });

  app.post("/api/saved-messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { messageId, chatId } = req.body ?? {};
    if (!messageId || typeof messageId !== "string" || !chatId || typeof chatId !== "string") {
      res.status(400).json({ message: "messageId и chatId обязательны" });
      return;
    }
    const memberIds = await storage.getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) {
      res.status(403).json({ message: "Нет доступа к чату" });
      return;
    }
    const msg = await storage.getMessage(chatId, messageId.trim());
    if (!msg) {
      res.status(404).json({ message: "Сообщение не найдено" });
      return;
    }
    await storage.saveMessage(userId, msg.id, chatId);
    res.status(201).json({ ok: true });
  });

  app.delete("/api/saved-messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const messageId = param(req.params, "messageId");
    await storage.unsaveMessage(userId, messageId);
    res.status(204).end();
  });

  app.get("/api/saved-messages/check/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const messageId = param(req.params, "messageId");
    const saved = await storage.isMessageSaved(userId, messageId);
    res.json({ saved });
  });
}
