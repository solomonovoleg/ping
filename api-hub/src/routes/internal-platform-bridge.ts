import type { Express, NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { bridgeIdemRelease, bridgeIdemTryClaim } from "../infra/bridge-idem-redis.js";
import {
  bumpBridgeAccepted,
  bumpBridgeAuth401,
  bumpBridgeForbiddenIp,
  bumpBridgeIdempotentDuplicate,
  bumpBridgeNotConfigured503,
  bumpBridgeRequest,
  bumpBridgeValidation400,
} from "../middleware/metrics.js";
import { emitHubEvent } from "../realtime/hub-events.js";
import { listBridgeNotifyTargets } from "../services/bridge-targets.js";
import type { RealtimeEnvelope } from "../types.js";

const IDEM_TTL_MS = 10 * 60 * 1000;
const bridgeIdem = new Map<string, number>();

function sweepIdem(now: number): void {
  for (const [k, t] of bridgeIdem) {
    if (now - t > IDEM_TTL_MS) bridgeIdem.delete(k);
  }
}

function isBridgeIdempotentDuplicate(key: string): boolean {
  sweepIdem(Date.now());
  return bridgeIdem.has(key);
}

function rememberBridgeIdempotencyKey(key: string): void {
  const now = Date.now();
  sweepIdem(now);
  bridgeIdem.set(key, now);
}

function normalizeClientIp(ip: string | undefined): string {
  if (!ip) return "";
  const t = ip.trim();
  if (t.startsWith("::ffff:")) return t.slice(7);
  return t;
}

function getBridgeClientIp(req: Request): string {
  const raw = config.bridgeTrustForwarded && req.ip ? String(req.ip) : req.socket.remoteAddress ?? "";
  return normalizeClientIp(raw);
}

function requireBridgeIp(req: Request, res: Response, next: NextFunction): void {
  const allow = config.bridgeAllowedIps;
  if (allow.length === 0) {
    next();
    return;
  }
  const ip = getBridgeClientIp(req);
  if (!ip || !allow.includes(ip)) {
    bumpBridgeForbiddenIp();
    res.status(403).json({ error: "forbidden_ip" });
    return;
  }
  next();
}

function requireBridgeAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = config.bridgeSecret.trim();
  if (!expected) {
    bumpBridgeNotConfigured503();
    res.status(503).json({ error: "bridge_not_configured" });
    return;
  }
  const h = req.headers.authorization;
  const tok =
    typeof h === "string" && h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  if (tok !== expected) {
    bumpBridgeAuth401();
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

function parseMemberUserIds(body: { memberUserIds?: unknown }): string[] | null {
  if (!Array.isArray(body.memberUserIds)) return null;
  const ids = body.memberUserIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return ids.length > 0 ? ids : null;
}

function parseChatId(body: { chatId?: unknown }): string | null {
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  return chatId || null;
}

type HubBridgeEvent = RealtimeEnvelope["event"];

function readIdempotencyKey(req: Request): string {
  const h = req.headers["idempotency-key"];
  if (typeof h !== "string") return "";
  return h.trim().slice(0, 200);
}

type IdemOk = { key: string; redisClaimed: boolean };

async function resolveBridgeIdem(req: Request): Promise<"duplicate" | "none" | IdemOk> {
  const key = readIdempotencyKey(req);
  if (!key) return "none";
  const claim = await bridgeIdemTryClaim(key);
  if (claim === "redis_duplicate") return "duplicate";
  if (claim === "redis_claimed") return { key, redisClaimed: true };
  if (isBridgeIdempotentDuplicate(key)) return "duplicate";
  return { key, redisClaimed: false };
}

export function registerInternalPlatformBridge(app: Express): void {
  app.post(
    "/internal/platform/chat-message",
    (req: Request, res: Response, next: NextFunction) => {
      bumpBridgeRequest();
      next();
    },
    requireBridgeIp,
    requireBridgeAuth,
    async (req: Request, res: Response) => {
      const idemRes = await resolveBridgeIdem(req);
      if (idemRes === "duplicate") {
        bumpBridgeIdempotentDuplicate();
        res.status(202).json({
          accepted: true,
          duplicate: true,
          deliveredToSessions: 0,
        });
        return;
      }

      const idemOk: IdemOk | null = idemRes === "none" ? null : idemRes;
      const releaseRedisIdem = async () => {
        if (idemOk?.redisClaimed) {
          await bridgeIdemRelease(idemOk.key);
        }
      };

      const body = req.body as Record<string, unknown>;
      const chatId = parseChatId(body);
      if (!chatId) {
        await releaseRedisIdem();
        bumpBridgeValidation400();
        res.status(400).json({ error: "invalid_body", detail: "chatId" });
        return;
      }
      const memberUserIds = parseMemberUserIds(body);
      if (!memberUserIds) {
        await releaseRedisIdem();
        bumpBridgeValidation400();
        res.status(400).json({ error: "invalid_body", detail: "memberUserIds" });
        return;
      }

      const rawEvent = body.event;
      const event: HubBridgeEvent =
        rawEvent === "message.updated" ||
        rawEvent === "message.deleted" ||
        rawEvent === "message.reactions.updated" ||
        rawEvent === "message.transcript.updated" ||
        rawEvent === "message.created"
          ? rawEvent
          : "message.created";

      if (event === "message.created" || event === "message.transcript.updated") {
        const message = body.message;
        if (message === undefined || message === null || typeof message !== "object") {
          await releaseRedisIdem();
          bumpBridgeValidation400();
          res.status(400).json({ error: "invalid_body", detail: "message" });
          return;
        }
      }

      if (event === "message.updated" || event === "message.deleted" || event === "message.reactions.updated") {
        const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
        if (!messageId) {
          await releaseRedisIdem();
          bumpBridgeValidation400();
          res.status(400).json({ error: "invalid_body", detail: "messageId" });
          return;
        }
      }

      if (event === "message.updated" && typeof body.content !== "string") {
        await releaseRedisIdem();
        bumpBridgeValidation400();
        res.status(400).json({ error: "invalid_body", detail: "content" });
        return;
      }

      if (event === "message.reactions.updated") {
        if (!Array.isArray(body.reactions)) {
          await releaseRedisIdem();
          bumpBridgeValidation400();
          res.status(400).json({ error: "invalid_body", detail: "reactions" });
          return;
        }
        const actorUserId = typeof body.actorUserId === "string" ? body.actorUserId.trim() : "";
        if (!actorUserId) {
          await releaseRedisIdem();
          bumpBridgeValidation400();
          res.status(400).json({ error: "invalid_body", detail: "actorUserId" });
          return;
        }
        const emoji =
          body.emoji === null ? null : typeof body.emoji === "string" ? body.emoji : undefined;
        if (emoji === undefined) {
          await releaseRedisIdem();
          bumpBridgeValidation400();
          res.status(400).json({ error: "invalid_body", detail: "emoji" });
          return;
        }
      }

      const targets = await listBridgeNotifyTargets(memberUserIds);

      const messageIdTrim = typeof body.messageId === "string" ? body.messageId.trim() : "";
      const contentStr = typeof body.content === "string" ? body.content : "";

      for (const t of targets) {
        const base = {
          recipientPingUserId: t.pingUserId,
          source: "ping_platform" as const,
          chatId,
        };

        if (event === "message.created") {
          emitHubEvent({
            partnerId: t.partnerId,
            channel: "message",
            event: "message.created",
            payload: {
              ...base,
              message: body.message as Record<string, unknown>,
            },
          });
          continue;
        }

        if (event === "message.transcript.updated") {
          emitHubEvent({
            partnerId: t.partnerId,
            channel: "message",
            event: "message.transcript.updated",
            payload: {
              ...base,
              message: body.message as Record<string, unknown>,
            },
          });
          continue;
        }

        if (event === "message.updated") {
          emitHubEvent({
            partnerId: t.partnerId,
            channel: "message",
            event: "message.updated",
            payload: {
              ...base,
              messageId: messageIdTrim,
              content: contentStr,
            },
          });
          continue;
        }

        if (event === "message.deleted") {
          emitHubEvent({
            partnerId: t.partnerId,
            channel: "message",
            event: "message.deleted",
            payload: {
              ...base,
              messageId: messageIdTrim,
            },
          });
          continue;
        }

        if (event === "message.reactions.updated") {
          const actorUserId = typeof body.actorUserId === "string" ? body.actorUserId.trim() : "";
          const emoji =
            body.emoji === null ? null : typeof body.emoji === "string" ? body.emoji : null;
          emitHubEvent({
            partnerId: t.partnerId,
            channel: "message",
            event: "message.reactions.updated",
            payload: {
              ...base,
              messageId: messageIdTrim,
              reactions: body.reactions as Array<{ emoji: string; count: number }>,
              actorUserId,
              emoji,
            },
          });
        }
      }

      if (idemOk && !idemOk.redisClaimed) {
        rememberBridgeIdempotencyKey(idemOk.key);
      }
      bumpBridgeAccepted(targets.length);
      res.status(202).json({ accepted: true, deliveredToSessions: targets.length, event });
    },
  );
}
