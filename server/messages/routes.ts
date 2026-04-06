import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
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
  requestVoiceOrVideoNoteTranscription,
  sendChatMessage,
} from "./service";
import { ServiceChatError } from "../service-chat/service";
import { createUserSlidingRateLimit } from "../middleware/create-user-sliding-rate-limit";
import { parsePositiveIntQuery } from "../http/parse-positive-int-query";
import { normalizeMessageType } from "./normalize-message-type";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

function sendMessagesKnownError(res: Response, error: unknown): boolean {
  if (error instanceof MessagesServiceError) {
    res.status(error.status).json({ message: error.message, code: "messages_error", retryable: error.status >= 500 });
    return true;
  }
  if (error instanceof ServiceChatError) {
    res.status(error.status).json({
      message: error.message,
      code: "service_chat_error",
      retryable: error.status >= 500,
    });
    return true;
  }
  return false;
}

function sendMessagesInternalError(res: Response, scope: string): void {
  res.status(500).json({
    message: "Временная ошибка сервиса сообщений. Попробуйте снова.",
    code: "messages_internal_error",
    scope,
    retryable: true,
  });
}

export function registerMessagesRoutes(app: Express): void {
  const sendMessageRateLimit = createUserSlidingRateLimit({
    windowMs: 60 * 1000,
    max: 40,
    message: "Слишком много сообщений. Попробуйте через минуту.",
  });

  app.get("/api/chats/:chatId/messages", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = parsePositiveIntQuery(req.query.limit, 100, 200);
    const beforeMessageId = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : undefined;
    const chatId = param(req.params, "chatId");
    try {
      const t0 = performance.now();
      const messages = await listChatMessages(userId, chatId, limit, beforeMessageId, folderId);
      const ms = Math.round(performance.now() - t0);
      if (ms >= 400 || process.env.LOG_ALL_LIST_MESSAGES_MS === "1") {
        console.info("[messages] list_messages_ms", {
          ms,
          requestId: req.requestId,
          chatId,
          count: messages.length,
        });
      }
      res.json(messages);
    } catch (error) {
      if (sendMessagesKnownError(res, error)) return;
      console.error("[messages] GET /api/chats/:chatId/messages failed", { chatId, userId, err: error });
      sendMessagesInternalError(res, "list_messages");
    }
  });

  if (process.env.DATABASE_URL) {
    registerMessageReactionsRoutes(app, (c, m) => storage.getMessage(c, m), (c) => storage.getChatMemberIds(c));
  }

  app.post(
    "/api/chats/:chatId/messages",
    noStorePrivateJson,
    requireAuth,
    sendMessageRateLimit,
    async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const {
      content,
      type = "text",
      folderId,
      replyToId,
      forwardedFromMessageId,
      originalChatId,
      scheduledAt,
      idempotencyKey: bodyIdempotencyKey,
    } = req.body ?? {};
    const headerIdem =
      typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : undefined;
    const idempotencyKey = headerIdem ?? bodyIdempotencyKey;
    if (typeof content !== "string" || !content.trim()) {
      res.status(400).json({ message: "content required" });
      return;
    }
    const chatId = param(req.params, "chatId");
    try {
      if (normalizeMessageType(type) === "system") {
        throw new MessagesServiceError(400, "Тип system недоступен для клиентской отправки");
      }
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
        idempotencyKey,
      });
      res.status(201).json(message);
    } catch (error) {
      if (sendMessagesKnownError(res, error)) return;
      console.error("[messages] POST /api/chats/:chatId/messages failed", { chatId, userId, err: error });
      sendMessagesInternalError(res, "send_message");
    }
    },
  );

  app.delete("/api/chats/:chatId/messages/:messageId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const messageId = param(req.params, "messageId");
    const forParam = typeof req.query.for === "string" ? req.query.for : undefined;
    const forEveryone = forParam === "everyone";
    try {
      await deleteOwnMessage(userId, chatId, messageId, forEveryone);
      res.status(204).end();
    } catch (error) {
      if (sendMessagesKnownError(res, error)) return;
      console.error("[messages] DELETE /api/chats/:chatId/messages/:messageId failed", { chatId, messageId, userId, err: error });
      sendMessagesInternalError(res, "delete_message");
    }
  });

  app.patch("/api/chats/:chatId/messages/:messageId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
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
      if (sendMessagesKnownError(res, error)) return;
      console.error("[messages] PATCH /api/chats/:chatId/messages/:messageId failed", { chatId, messageId, userId, err: error });
      sendMessagesInternalError(res, "edit_message");
    }
  });

  app.post(
    "/api/chats/:chatId/messages/:messageId/transcribe",
    noStorePrivateJson,
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const chatId = param(req.params, "chatId");
      const messageId = param(req.params, "messageId");
      try {
        const result = await requestVoiceOrVideoNoteTranscription(userId, chatId, messageId);
        res.json(result);
      } catch (error) {
        if (sendMessagesKnownError(res, error)) return;
        console.error("[messages] POST transcribe failed", { chatId, messageId, userId, err: error });
        sendMessagesInternalError(res, "transcribe_message");
      }
    },
  );
}
