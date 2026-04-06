import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import {
  edgeUpstreamReachable,
  fetchUpstreamCampaignConfig,
  fetchUpstreamMoneyCampaignConfig,
  fetchUpstreamParticipantPath,
  getEdgeUpstreamBase,
  type UpstreamCampaignResult,
} from "./upstream-client";
import {
  extractPresetVerifyFromCompanionBody,
  needsPlatformVerify,
} from "./companion-preset-from-response";
import { hasObjectiveTaskVerify } from "@shared/edge-task-preset-config";
import { verifyPresetOnPlatform } from "./verify-preset-platform";
import { handlePostPingInvitePack } from "./ping-invite-pack";
import { handleGetMoneyInviteProgress, handlePostMoneyInvitePack } from "../edge-money-invite";
import { enrichEdgeLeaderboardBodyJson } from "./leaderboard-enrich";
import { storage } from "../storage";
import { normalizeEdgeDisplayAudience, syncPostsEdgeDisplayAudience } from "../posts/edge-display-audience";
import { notifyPrizeDrawWinners } from "./prize-draw-notify";
import { fetchMoneyTrackingStartedFromEdge, postMoneyStartTrackingUpstream } from "./fetch-money-tracking";
import { handleGetMoneyTaskProgress } from "./handle-get-money-task-progress";

const BUILTIN_EDGE_TASK_KEYS = new Set(["view_post", "react_post", "share_post", "follow_creator"]);

/** Только `interact` kind=tap: анти-накрутка; лимит выше пачек анимаций/ретраев клиента (~80/мин на кампанию). */
const EDGE_TAP_RATE_WINDOW_MS = 60_000;
const EDGE_TAP_RATE_MAX = 80;
const edgeTapTimestamps = new Map<string, number[]>();

/** Анти-спам на «Забрать награду» по заданиям (отдельно от тапов). */
const EDGE_TASK_CLAIM_WINDOW_MS = 60_000;
const EDGE_TASK_CLAIM_MAX = 35;
const edgeTaskClaimTimestamps = new Map<string, number[]>();

function sendEdgeBusinessRequired(res: Response): void {
  res.status(403).json({
    error: "business_status_required",
    message: "EDGE доступен только бизнес-аккаунтам со статусом approved.",
  });
}

async function requireEdgeCreatorBusinessApproved(userId: string, res: Response): Promise<boolean> {
  const viewer = await storage.getUser(userId);
  if (viewer?.businessStatus === "approved") return true;
  sendEdgeBusinessRequired(res);
  return false;
}

function allowEdgeTaskClaimRate(
  userId: string,
  edgeId: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = `${userId}\n${edgeId}`;
  const now = Date.now();
  const cutoff = now - EDGE_TASK_CLAIM_WINDOW_MS;
  let arr = edgeTaskClaimTimestamps.get(key) ?? [];
  arr = arr.filter((t) => t > cutoff);
  if (arr.length >= EDGE_TASK_CLAIM_MAX) {
    const oldest = arr[0]!;
    const retryAfterMs = oldest + EDGE_TASK_CLAIM_WINDOW_MS - now;
    edgeTaskClaimTimestamps.set(key, arr);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  arr.push(now);
  edgeTaskClaimTimestamps.set(key, arr);
  return { ok: true };
}

function allowEdgeTapRate(userId: string, edgeId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = `${userId}\n${edgeId}`;
  const now = Date.now();
  const cutoff = now - EDGE_TAP_RATE_WINDOW_MS;
  let arr = edgeTapTimestamps.get(key) ?? [];
  arr = arr.filter((t) => t > cutoff);
  if (arr.length >= EDGE_TAP_RATE_MAX) {
    const oldest = arr[0]!;
    const retryAfterMs = oldest + EDGE_TAP_RATE_WINDOW_MS - now;
    edgeTapTimestamps.set(key, arr);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  arr.push(now);
  edgeTapTimestamps.set(key, arr);
  return { ok: true };
}

function sendParticipantUpstream(res: Response, up: UpstreamCampaignResult): void {
  if (!up.ok) {
    res.status(503).json({ error: "edge_participant_unavailable" });
    return;
  }
  res.status(up.status).type("application/json").send(up.body);
}

/** Тапы/корм/награды не принимаются GET — прогресс только POST + логика в EDGE. */
function edgeParticipantMutationGetNotAllowed(_req: Request, res: Response): void {
  res.setHeader("Allow", "POST");
  res.status(405).json({
    error: "method_not_allowed",
    message: "Действия персонажа и начисления только через POST; GET не меняет прогресс и XP.",
  });
}

/**
 * Маршруты `/api/edge/*` на платформе.
 * С `EDGE_UPSTREAM_URL` — прокси на микросервис EDGE; при недоступности — 503 JSON (без фейковых тел).
 */
export function registerEdgeRoutes(app: Express): void {
  app.get("/api/edge/health", (_req: Request, res: Response) => {
    void (async () => {
      const companionBackend = getEdgeUpstreamBase() ? await edgeUpstreamReachable() : false;
      res.json({
        ok: true,
        service: "ping-moot-platform",
        companionBackend,
      });
    })();
  });

  app.get("/api/edge/companion/campaign-config", (req: Request, res: Response) => {
    void (async () => {
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await fetchUpstreamCampaignConfig(edgeId, req.requestId);
      if (up.ok && up.status >= 200 && up.status < 300) {
        try {
          const parsed = JSON.parse(up.body) as {
            displayAudience?: unknown;
            creatorPlatformUserId?: unknown;
          };
          const aud = normalizeEdgeDisplayAudience(
            typeof parsed.displayAudience === "string" ? parsed.displayAudience : undefined,
          );
          const creatorId =
            typeof parsed.creatorPlatformUserId === "string" ? parsed.creatorPlatformUserId.trim() : "";
          const viewerId = getUserId(req) ?? null;
          if (aud === "self") {
            if (!viewerId || viewerId !== creatorId) {
              res.status(404).json({ error: "edge_campaign_not_found" });
              return;
            }
          } else if (aud === "followers") {
            if (!creatorId) {
              res.status(404).json({ error: "edge_campaign_not_found" });
              return;
            }
            if (!viewerId || (viewerId !== creatorId && !(await storage.isFollowing(viewerId, creatorId)))) {
              res.status(404).json({ error: "edge_campaign_not_found" });
              return;
            }
          }
        } catch {
          /* некорректный JSON — отдаём как есть */
        }
        res.status(up.status).type("application/json").send(up.body);
        return;
      }
      res.status(503).json({ error: "edge_companion_unavailable" });
    })();
  });

  app.get("/api/edge/money/campaign-config", (req: Request, res: Response) => {
    void (async () => {
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await fetchUpstreamMoneyCampaignConfig(edgeId, req.requestId);
      if (!up.ok) {
        res.status(503).json({ error: "edge_money_unavailable" });
        return;
      }
      if (up.status >= 200 && up.status < 300) {
        try {
          const parsed = JSON.parse(up.body) as {
            displayAudience?: unknown;
            creatorPlatformUserId?: unknown;
          };
          const aud = normalizeEdgeDisplayAudience(
            typeof parsed.displayAudience === "string" ? parsed.displayAudience : undefined,
          );
          const creatorId =
            typeof parsed.creatorPlatformUserId === "string" ? parsed.creatorPlatformUserId.trim() : "";
          const viewerId = getUserId(req) ?? null;
          if (aud === "self") {
            if (!viewerId || viewerId !== creatorId) {
              res.status(404).json({ error: "edge_campaign_not_found" });
              return;
            }
          } else if (aud === "followers") {
            if (!creatorId) {
              res.status(404).json({ error: "edge_campaign_not_found" });
              return;
            }
            if (!viewerId || (viewerId !== creatorId && !(await storage.isFollowing(viewerId, creatorId)))) {
              res.status(404).json({ error: "edge_campaign_not_found" });
              return;
            }
          }
        } catch {
          /* некорректный JSON — отдаём как есть */
        }
        res.status(up.status).type("application/json").send(up.body);
        return;
      }
      res.status(up.status).type("application/json").send(up.body);
    })();
  });

  app.get("/api/edge/money/ping-invite-pack", requireAuth, edgeParticipantMutationGetNotAllowed);
  /** EDGE MONEY: тройка рефкодов + ЛС от создателя (без verify «уже N приглашённых»). */
  app.post("/api/edge/money/ping-invite-pack", requireAuth, (req: Request, res: Response) => {
    void handlePostMoneyInvitePack(req, res);
  });
  /** Прогресс по открытой партии кодов и лимиты на новую тройку. */
  app.get("/api/edge/money/invite-progress", requireAuth, (req: Request, res: Response) => {
    void handleGetMoneyInviteProgress(req, res);
  });

  /** Прогресс по заданиям MONEY (счётчики платформы + EDGE) для полос и подписей в UI. */
  app.get("/api/edge/money/task-progress", requireAuth, (req: Request, res: Response) => {
    void handleGetMoneyTaskProgress(req, res);
  });

  app.get("/api/edge/money/tracking-started", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const started = await fetchMoneyTrackingStartedFromEdge(edgeId, userId);
      if (started === null) {
        res.status(503).json({ error: "edge_money_unavailable" });
        return;
      }
      res.json({ started });
    })();
  });

  app.post("/api/edge/money/start-tracking", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const raw = req.body;
      const edgeId =
        raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { edgeId?: unknown }).edgeId === "string"
          ? String((raw as { edgeId: string }).edgeId).trim()
          : "";
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await postMoneyStartTrackingUpstream(edgeId, userId);
      if (!up.ok) {
        try {
          const j = JSON.parse(up.body) as { error?: string };
          res.status(up.status).json(j);
        } catch {
          res.status(up.status).json({ error: "edge_request_failed" });
        }
        return;
      }
      res.json({ ok: true });
    })();
  });

  /** Состояние персонажа для текущего пользователя (сессия / Bearer). Прокси на EDGE. */
  app.get("/api/edge/participant/state", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const qs = new URLSearchParams({ edgeId });
      const up = await fetchUpstreamParticipantPath(`/v1/participant/state?${qs}`, {
        requestId: req.requestId,
        method: "GET",
        platformUserId: userId,
      });
      if (up.ok && up.status >= 200 && up.status < 300) {
        res.status(up.status).type("application/json").send(up.body);
        return;
      }
      res.status(503).json({ error: "edge_participant_unavailable" });
    })();
  });

  /** Лидерборд кампании (прокси на EDGE). Без маршрута клиент получал 404 «Not found». */
  app.get("/api/edge/participant/leaderboard", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const kindRaw = String(req.query.kind ?? "primary").trim().toLowerCase();
      const kind = kindRaw === "secondary" ? "secondary" : "primary";
      const qs = new URLSearchParams({ edgeId, kind });
      const up = await fetchUpstreamParticipantPath(`/v1/participant/leaderboard?${qs}`, {
        requestId: req.requestId,
        method: "GET",
        platformUserId: userId,
      });
      if (up.ok && up.status >= 200 && up.status < 300) {
        let body = up.body;
        try {
          body = await enrichEdgeLeaderboardBodyJson(up.body);
        } catch (e) {
          console.error("[edge] leaderboard enrich failed", e);
        }
        res.status(up.status).type("application/json").send(body);
        return;
      }
      res.status(503).json({ error: "edge_participant_unavailable" });
    })();
  });

  app.get("/api/edge/participant/feed", requireAuth, edgeParticipantMutationGetNotAllowed);
  app.get("/api/edge/participant/interact", requireAuth, edgeParticipantMutationGetNotAllowed);
  app.get("/api/edge/participant/task", requireAuth, edgeParticipantMutationGetNotAllowed);
  app.get("/api/edge/participant/follow-reward", requireAuth, edgeParticipantMutationGetNotAllowed);
  app.get("/api/edge/participant/ping-invite-pack", requireAuth, edgeParticipantMutationGetNotAllowed);

  app.post("/api/edge/participant/feed", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const qs = new URLSearchParams({ edgeId });
      const up = await fetchUpstreamParticipantPath(`/v1/participant/feed?${qs}`, {
        requestId: req.requestId,
        method: "POST",
        platformUserId: userId,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  app.post("/api/edge/participant/interact", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const bodyObj = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      const interactKind =
        typeof (bodyObj as { kind?: unknown }).kind === "string"
          ? String((bodyObj as { kind: string }).kind).trim().toLowerCase()
          : "";
      if (interactKind === "tap") {
        const gate = allowEdgeTapRate(userId, edgeId);
        if (!gate.ok) {
          res.status(429).json({
            error: "tap_rate_limited",
            retryAfterSec: gate.retryAfterSec,
          });
          return;
        }
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const qs = new URLSearchParams({ edgeId });
      const payload = JSON.stringify(bodyObj);
      const up = await fetchUpstreamParticipantPath(`/v1/participant/interact?${qs}`, {
        requestId: req.requestId,
        method: "POST",
        platformUserId: userId,
        body: payload,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  app.post("/api/edge/participant/task", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const edgeId = String(req.query.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ error: "edgeId_required" });
        return;
      }
      const taskGate = allowEdgeTaskClaimRate(userId, edgeId);
      if (!taskGate.ok) {
        res.status(429).json({
          error: "edge_task_rate_limited",
          retryAfterSec: taskGate.retryAfterSec,
        });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const bodyObj = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      const taskKeyRaw = typeof (bodyObj as { taskKey?: unknown }).taskKey === "string"
        ? String((bodyObj as { taskKey: string }).taskKey).trim()
        : "";

      if (taskKeyRaw && !BUILTIN_EDGE_TASK_KEYS.has(taskKeyRaw)) {
        const cfgUp = await fetchUpstreamCampaignConfig(edgeId, req.requestId);
        if (!cfgUp.ok || cfgUp.status < 200 || cfgUp.status >= 300) {
          res.status(503).json({ error: "edge_companion_unavailable" });
          return;
        }
        const extracted = extractPresetVerifyFromCompanionBody(cfgUp.body, taskKeyRaw);
        if (extracted) {
          if (!hasObjectiveTaskVerify(extracted.verify)) {
            res.status(403).json({
              error: "preset_verification_failed",
              reason: "honor_task_disabled",
            });
            return;
          }
          if (needsPlatformVerify(extracted.verify)) {
            const gate = await verifyPresetOnPlatform({
              userId,
              edgeId,
              creatorPlatformUserId: extracted.creatorPlatformUserId,
              verify: extracted.verify,
            });
            if (!gate.ok) {
              res.status(403).json({ error: "preset_verification_failed", reason: gate.reason });
              return;
            }
          }
        }
      }

      const qs = new URLSearchParams({ edgeId });
      const payload = JSON.stringify(bodyObj);
      const up = await fetchUpstreamParticipantPath(`/v1/participant/task?${qs}`, {
        requestId: req.requestId,
        method: "POST",
        platformUserId: userId,
        body: payload,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  /** Пакет реферальных кодов для задания «пригласить» + ЛС от создателя с шаблоном. */
  app.post("/api/edge/participant/ping-invite-pack", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      try {
        await handlePostPingInvitePack(req, res);
      } catch (e) {
        if (res.headersSent) return;
        console.error("[edge/ping-invite-pack] route", e);
        res.status(500).json({
          error: "invite_pack_failed",
          message: e instanceof Error ? e.message : "unknown",
        });
      }
    })();
  });

  app.post("/api/edge/participant/follow-reward", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const bodyObj = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      const followedId =
        typeof (bodyObj as { followedPlatformUserId?: unknown }).followedPlatformUserId === "string"
          ? (bodyObj as { followedPlatformUserId: string }).followedPlatformUserId.trim()
          : "";
      if (!followedId) {
        res.status(400).json({ error: "followed_platform_user_id_required" });
        return;
      }
      /** Не доверяем телу запроса: XP за подписку только при реальной строке в `follows`. */
      const following = await storage.isFollowing(userId, followedId);
      if (!following) {
        res.status(403).json({ error: "follow_not_found" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const payload = JSON.stringify(bodyObj);
      const up = await fetchUpstreamParticipantPath(`/v1/participant/follow-reward`, {
        requestId: req.requestId,
        method: "POST",
        platformUserId: userId,
        body: payload,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  /** Кампании создателя (EDGE), `creator_platform_user_id` = текущий пользователь. */
  app.get("/api/edge/my-campaigns", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (!(await requireEdgeCreatorBusinessApproved(userId, res))) return;
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns`, {
        requestId: req.requestId,
        method: "GET",
        platformUserId: userId,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  app.get("/api/edge/creator/campaigns/:edgeId", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (!(await requireEdgeCreatorBusinessApproved(userId, res))) return;
      const raw = String(req.params.edgeId ?? "").trim();
      if (!raw) {
        res.status(400).json({ error: "edge_id_required" });
        return;
      }
      const edgeId = encodeURIComponent(raw);
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns/${edgeId}`, {
        requestId: req.requestId,
        method: "GET",
        platformUserId: userId,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  app.post("/api/edge/creator/campaigns", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (!(await requireEdgeCreatorBusinessApproved(userId, res))) return;
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const payload =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? JSON.stringify(req.body)
          : JSON.stringify({});
      const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns`, {
        requestId: req.requestId,
        method: "POST",
        platformUserId: userId,
        body: payload,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  app.get("/api/edge/creator/campaigns/:edgeId/life-stats", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (!(await requireEdgeCreatorBusinessApproved(userId, res))) return;
      const raw = String(req.params.edgeId ?? "").trim();
      if (!raw) {
        res.status(400).json({ error: "edge_id_required" });
        return;
      }
      const edgeId = encodeURIComponent(raw);
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns/${edgeId}/life-stats`, {
        requestId: req.requestId,
        method: "GET",
        platformUserId: userId,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  app.patch("/api/edge/creator/campaigns/:edgeId", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      if (!(await requireEdgeCreatorBusinessApproved(userId, res))) return;
      const raw = String(req.params.edgeId ?? "").trim();
      if (!raw) {
        res.status(400).json({ error: "edge_id_required" });
        return;
      }
      const edgeId = encodeURIComponent(raw);
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const payload =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? JSON.stringify(req.body)
          : JSON.stringify({});
      const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns/${edgeId}`, {
        requestId: req.requestId,
        method: "PATCH",
        platformUserId: userId,
        body: payload,
      });
      if (up.ok && up.status >= 200 && up.status < 300) {
        const patchBody =
          req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>)
            : null;
        if (patchBody && typeof patchBody.displayAudience === "string") {
          try {
            await syncPostsEdgeDisplayAudience(raw, patchBody.displayAudience);
          } catch (e) {
            console.error("[edge] syncPostsEdgeDisplayAudience", e);
          }
        }
      }
      sendParticipantUpstream(res, up);
    })();
  });

  /**
   * Розыгрыш приза создателем + ЛС победителям (шаблон приза или стандартный текст).
   * Тело как у EDGE POST …/prize-draw: giftKey?, count?, pool?, method?, topN?, rankingKind?, notify?
   */
  app.post("/api/edge/creator/campaigns/:edgeId/prize-draw", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        if (!(await requireEdgeCreatorBusinessApproved(userId, res))) return;
        const raw = String(req.params.edgeId ?? "").trim();
        if (!raw) {
          res.status(400).json({ error: "edge_id_required" });
          return;
        }
        const edgeId = encodeURIComponent(raw);
        const base = getEdgeUpstreamBase();
        if (!base) {
          res.status(503).json({ error: "edge_upstream_not_configured" });
          return;
        }
        const bodyObj = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
        const notify = (bodyObj as { notify?: unknown }).notify !== false;
        const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns/${edgeId}/prize-draw`, {
          requestId: req.requestId,
          method: "POST",
          platformUserId: userId,
          body: JSON.stringify(bodyObj),
        });
        if (!up.ok) {
          res.status(503).json({ error: "edge_participant_unavailable" });
          return;
        }
        if (up.status < 200 || up.status >= 300) {
          res.status(up.status).type("application/json").send(up.body);
          return;
        }
        type DrawBody = {
          campaignTitle: string;
          giftLabel: string;
          winners: { platformUserId: string; giftKey: string; giftLabel: string }[];
          winnerDm?: { text: string; mediaUrl: string | null } | null;
          creatorPlatformUserId: string | null;
          drawBatchId: string;
          edgeId: string;
          giftKey: string;
          poolSize: number;
          requestedCount: number;
          /** Если есть — сверяется с числом уникальных `winners` (после дедупликации). */
          drawnCount?: number;
        };
        let drawPayload: DrawBody;
        try {
          drawPayload = JSON.parse(up.body) as DrawBody;
        } catch {
          res.status(502).json({ error: "invalid_edge_response" });
          return;
        }
        const dmResults: { platformUserId: string; ok: boolean; error?: string }[] = [];
        const sessionUser = userId.trim();
        const edgeCreator = (drawPayload.creatorPlatformUserId ?? "").trim();
        /** ЛС только от вошедшего создателя и только победителям из ответа EDGE — без EDGE_PRIZE_NOTIFY_USER_ID. */
        let prizeDmSenderId: string | null = null;
        let creatorPrizeSkipReason: string | undefined;
        if (notify && Array.isArray(drawPayload.winners) && drawPayload.winners.length > 0) {
          if (!edgeCreator) {
            creatorPrizeSkipReason =
              "ЛС не отправлены: у кампании не задан создатель на платформе (creator_platform_user_id).";
          } else if (edgeCreator !== sessionUser) {
            creatorPrizeSkipReason =
              "ЛС не отправлены: создатель кампании в EDGE не совпадает с вашим аккаунтом.";
            console.warn("[edge/creator/prize-draw] creator mismatch", { edgeCreator, sessionUser });
          } else {
            prizeDmSenderId = sessionUser;
          }
        }
        const attempted = Boolean(notify && drawPayload.winners?.length);
        if (notify && prizeDmSenderId && drawPayload.winners?.length) {
          const results = await notifyPrizeDrawWinners({
            senderId: prizeDmSenderId,
            payload: {
              campaignTitle: drawPayload.campaignTitle,
              giftLabel: drawPayload.giftLabel,
              winners: drawPayload.winners,
              winnerDm: drawPayload.winnerDm,
              drawnCount: drawPayload.drawnCount,
            },
          });
          dmResults.push(...results);
        }
        res.status(201).json({
          ...drawPayload,
          notifications: {
            attempted: attempted && Boolean(prizeDmSenderId),
            senderUserId: prizeDmSenderId,
            skippedReason:
              notify && attempted && !prizeDmSenderId
                ? creatorPrizeSkipReason ??
                  "ЛС не отправлены: проверьте, что кампания привязана к вашему аккаунту."
                : undefined,
            results: dmResults,
          },
        });
      } catch (e) {
        if (res.headersSent) return;
        console.error("[edge/creator/prize-draw]", e);
        res.status(500).json({ error: "prize_draw_failed" });
      }
    })();
  });
}
