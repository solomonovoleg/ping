import { Router } from "express";
import { z } from "zod";
import { partnerAuth } from "../middleware/partner-auth.js";
import { requireSession } from "../middleware/session-auth.js";
import { userRateLimit } from "../middleware/rate-limit.js";
import { HttpError } from "../lib/http-error.js";
import { store } from "../store/in-memory-store.js";
import { emitHubEvent } from "../realtime/hub-events.js";
import { getPingPlatformPmBearer } from "../platform/ping-platform-session.js";
import {
  PlatformProxyError,
  proxyPlatformAddReaction,
  proxyPlatformListChats,
  proxyPlatformListMessages,
  proxyPlatformMarkRead,
  proxyPlatformSendMessage,
} from "../platform/ping-chats-client.js";

const sendSchema = z.object({
  kind: z.enum(["text", "image", "voice_note", "video_note"]).default("text"),
  text: z.string().trim().min(1).max(5000).optional(),
  media: z
    .object({
      mediaId: z.string().min(1),
      url: z.string().min(1),
      durationMs: z.number().int().positive().optional(),
      waveform: z.array(z.number()).max(256).optional(),
      posterUrl: z.string().optional(),
    })
    .optional(),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
  chatId: z.string().min(1).optional(),
});

const statusSchema = z.object({
  status: z.enum(["delivered", "read"]),
  chatId: z.string().min(1).optional(),
});

export const chatRoutes = Router();

function mapPlatformErr(e: unknown): never {
  if (e instanceof PlatformProxyError) {
    const st =
      e.status === 401 || e.status === 403 || e.status === 404
        ? e.status
        : e.status >= 500
          ? 502
          : 400;
    throw new HttpError(st, "platform_proxy_error", e.message, e.payload);
  }
  throw e;
}

function hubSendToPlatformBody(parsed: z.infer<typeof sendSchema>): { content: string; type: string } {
  if (parsed.kind === "text") {
    const t = parsed.text?.trim();
    if (!t) {
      throw new HttpError(400, "invalid_body", "text required for kind=text");
    }
    return { content: t, type: "text" };
  }
  const url = parsed.media?.url?.trim();
  if (!url) {
    throw new HttpError(400, "invalid_body", "media.url required for voice/video note");
  }
  if (parsed.kind === "image") return { content: url, type: "image" };
  if (parsed.kind === "voice_note") return { content: url, type: "voice" };
  return { content: url, type: "video_note" };
}

chatRoutes.get("/chats", partnerAuth, requireSession(["chat.read"]), userRateLimit, (req, res, next) => {
  void (async () => {
    const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
    if (pm) {
      try {
        const chats = await proxyPlatformListChats(pm);
        res.json({ ok: true, chats, source: "ping_platform" });
      } catch (e) {
        mapPlatformErr(e);
      }
      return;
    }
    const chats = store.listChats(req.sessionAuth!.pingUserId);
    res.json({ ok: true, chats, source: "api_hub_demo" });
  })().catch(next);
});

chatRoutes.get(
  "/chats/:chatId/messages",
  partnerAuth,
  requireSession(["chat.read"]),
  userRateLimit,
  (req, res, next) => {
    void (async () => {
      const chatId = String(req.params.chatId);
      const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
      if (pm) {
        try {
          const limitRaw = req.query.limit != null ? Number(req.query.limit) : undefined;
          const before = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
          const messages = await proxyPlatformListMessages(pm, chatId, {
            limit: limitRaw != null && Number.isFinite(limitRaw) ? limitRaw : 100,
            before,
          });
          res.json({ ok: true, messages, source: "ping_platform" });
        } catch (e) {
          mapPlatformErr(e);
        }
        return;
      }
      const chat = store.chats.get(chatId);
      if (!chat || !chat.participantIds.includes(req.sessionAuth!.pingUserId)) {
        throw new HttpError(404, "chat_not_found", "Chat not found");
      }
      res.json({ ok: true, messages: store.listMessages(chatId), source: "api_hub_demo" });
    })().catch(next);
  },
);

chatRoutes.post(
  "/chats/:chatId/messages:send",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  (req, res, next) => {
    void (async () => {
      const chatId = String(req.params.chatId);
      const parsed = sendSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "invalid_body", "Invalid message payload", parsed.error.flatten());
      }
      const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
      if (pm) {
        try {
          const body = hubSendToPlatformBody(parsed.data);
          const message = await proxyPlatformSendMessage(pm, chatId, body);
          emitHubEvent({
            partnerId: req.sessionAuth!.partnerId,
            channel: "message",
            event: "message.created",
            payload: message,
          });
          res.status(201).json({ ok: true, message, source: "ping_platform" });
        } catch (e) {
          mapPlatformErr(e);
        }
        return;
      }
      const chat = store.chats.get(chatId);
      if (!chat || !chat.participantIds.includes(req.sessionAuth!.pingUserId)) {
        throw new HttpError(404, "chat_not_found", "Chat not found");
      }
      const idempotencyKey = req.headers["idempotency-key"]?.toString();
      const message = store.createMessage({
        chatId,
        senderPingUserId: req.sessionAuth!.pingUserId,
        kind: parsed.data.kind,
        text: parsed.data.text,
        media: parsed.data.media,
        idempotencyKey,
      });
      emitHubEvent({
        partnerId: req.sessionAuth!.partnerId,
        channel: "message",
        event: "message.created",
        payload: message,
      });
      res.status(201).json({ ok: true, message, source: "api_hub_demo" });
    })().catch(next);
  },
);

chatRoutes.post(
  "/messages/:messageId/reactions",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  (req, res, next) => {
    void (async () => {
      const messageId = String(req.params.messageId);
      const parsed = reactionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "invalid_body", "Invalid reaction payload", parsed.error.flatten());
      }
      const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
      if (pm) {
        const chatId = parsed.data.chatId?.trim();
        if (!chatId) {
          throw new HttpError(
            400,
            "chat_id_required",
            "Для прокси на платформу укажите chatId в теле: { \"emoji\": \"…\", \"chatId\": \"…\" }",
          );
        }
        try {
          const message = await proxyPlatformAddReaction(pm, chatId, messageId, parsed.data.emoji);
          emitHubEvent({
            partnerId: req.sessionAuth!.partnerId,
            channel: "message",
            event: "message.created",
            payload: message,
          });
          res.json({ ok: true, message, source: "ping_platform" });
        } catch (e) {
          mapPlatformErr(e);
        }
        return;
      }
      const message = store.addReaction(messageId, parsed.data.emoji, req.sessionAuth!.pingUserId);
      if (!message) {
        throw new HttpError(404, "message_not_found", "Message not found");
      }
      emitHubEvent({
        partnerId: req.sessionAuth!.partnerId,
        channel: "message",
        event: "message.created",
        payload: message,
      });
      res.json({ ok: true, message, source: "api_hub_demo" });
    })().catch(next);
  },
);

chatRoutes.post(
  "/messages/:messageId/status",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  (req, res, next) => {
    void (async () => {
      const messageId = String(req.params.messageId);
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "invalid_body", "Invalid status payload", parsed.error.flatten());
      }
      const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
      if (pm) {
        if (parsed.data.status === "read") {
          const chatId = parsed.data.chatId?.trim();
          if (!chatId) {
            throw new HttpError(
              400,
              "chat_id_required",
              "Для read на платформе укажите chatId в теле: { \"status\": \"read\", \"chatId\": \"…\" }",
            );
          }
          try {
            await proxyPlatformMarkRead(pm, chatId, messageId);
          } catch (e) {
            mapPlatformErr(e);
          }
          res.json({
            ok: true,
            source: "ping_platform",
            message: { id: messageId, chatId, status: "read" as const },
          });
          return;
        }
        res.json({
          ok: true,
          source: "ping_platform",
          note: "delivered не проксируется на платформу; статус принят без изменений",
          message: { id: messageId, status: "delivered" as const },
        });
        return;
      }
      const message = store.setDeliveryStatus(
        messageId,
        req.sessionAuth!.pingUserId,
        parsed.data.status,
      );
      if (!message) {
        throw new HttpError(404, "message_not_found", "Message not found");
      }
      const event = parsed.data.status === "delivered" ? "message.delivered" : "message.read";
      emitHubEvent({
        partnerId: req.sessionAuth!.partnerId,
        channel: "receipt",
        event,
        payload: {
          messageId: message.id,
          chatId: message.chatId,
          actorPingUserId: req.sessionAuth!.pingUserId,
          status: parsed.data.status,
          updatedAt: new Date().toISOString(),
        },
      });
      res.json({ ok: true, message, source: "api_hub_demo" });
    })().catch(next);
  },
);
