import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import {
  registerMessageReactionsRoutes,
} from "./reactions";
import { storage } from "../storage";
import {
  createScheduledMessage,
  deleteOwnMessage,
  editOwnTextMessage,
  listChatMessages,
  MessagesServiceError,
  sendChatMessage,
} from "./service";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerMessagesRoutes(app: Express): void {
  app.get("/api/chats/:chatId/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 100;
    const beforeMessageId = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : undefined;
    const chatId = param(req.params, "chatId");
    try {
      const messages = await listChatMessages(userId, chatId, limit, beforeMessageId, folderId);
      res.json(messages);
    } catch (error) {
      if (error instanceof MessagesServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      console.error("[messages] GET /api/chats/:chatId/messages failed", { chatId, userId, err: error });
      throw error;
    }
  });

  if (process.env.DATABASE_URL) {
    registerMessageReactionsRoutes(app, (c, m) => storage.getMessage(c, m), (c) => storage.getChatMemberIds(c));
  }

  app.post("/api/chats/:chatId/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { content, type = "text", folderId, replyToId, forwardedFromMessageId, originalChatId, scheduledAt } = req.body ?? {};
    if (!content || typeof content !== "string") {
      res.status(400).json({ message: "content required" });
      return;
    }
    const chatId = param(req.params, "chatId");
    try {
      if (scheduledAt) {
        const scheduled = await createScheduledMessage({
          userId,
          chatId,
          content,
          folderId: typeof folderId === "string" ? folderId : undefined,
          type,
          replyToId,
          scheduledAt,
        });
        return res.status(201).json(scheduled);
      }
      const message = await sendChatMessage({
        userId,
        chatId,
        content,
        folderId: typeof folderId === "string" ? folderId : undefined,
        type,
        replyToId,
        forwardedFromMessageId,
        originalChatId,
      });
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof MessagesServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete("/api/chats/:chatId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const messageId = param(req.params, "messageId");
    const forParam = typeof req.query.for === "string" ? req.query.for : undefined;
    const forEveryone = forParam === "everyone";
    try {
      await deleteOwnMessage(userId, chatId, messageId, forEveryone);
      res.status(204).end();
    } catch (error) {
      if (error instanceof MessagesServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.patch("/api/chats/:chatId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const messageId = param(req.params, "messageId");
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      res.status(400).json({ message: "content обязателен" });
      return;
    }
    try {
      const updated = await editOwnTextMessage(userId, chatId, messageId, content);
      res.json(updated);
    } catch (error) {
      if (error instanceof MessagesServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });
}
