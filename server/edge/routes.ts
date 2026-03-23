import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import {
  edgeUpstreamReachable,
  fetchUpstreamCampaignConfig,
  fetchUpstreamParticipantPath,
  getEdgeUpstreamBase,
  type UpstreamCampaignResult,
} from "./upstream-client";
import { extractPresetVerifyFromCompanionBody, needsPlatformVerify } from "./companion-preset-from-response";
import { verifyPresetOnPlatform } from "./verify-preset-platform";
import { handlePostPingInvitePack } from "./ping-invite-pack";

const BUILTIN_EDGE_TASK_KEYS = new Set(["view_post", "react_post", "share_post", "follow_creator"]);

function sendParticipantUpstream(res: Response, up: UpstreamCampaignResult): void {
  if (!up.ok) {
    res.status(503).json({ error: "edge_participant_unavailable" });
    return;
  }
  res.status(up.status).type("application/json").send(up.body);
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
      const up = await fetchUpstreamCampaignConfig(edgeId);
      if (up.ok && up.status >= 200 && up.status < 300) {
        res.status(up.status).type("application/json").send(up.body);
        return;
      }
      res.status(503).json({ error: "edge_companion_unavailable" });
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
      const qs = new URLSearchParams({ edgeId });
      const up = await fetchUpstreamParticipantPath(`/v1/participant/leaderboard?${qs}`, {
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
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const qs = new URLSearchParams({ edgeId });
      const payload =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? JSON.stringify(req.body)
          : JSON.stringify({});
      const up = await fetchUpstreamParticipantPath(`/v1/participant/interact?${qs}`, {
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
        const cfgUp = await fetchUpstreamCampaignConfig(edgeId);
        if (!cfgUp.ok || cfgUp.status < 200 || cfgUp.status >= 300) {
          res.status(503).json({ error: "edge_companion_unavailable" });
          return;
        }
        const extracted = extractPresetVerifyFromCompanionBody(cfgUp.body, taskKeyRaw);
        if (extracted && needsPlatformVerify(extracted.verify)) {
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

      const qs = new URLSearchParams({ edgeId });
      const payload = JSON.stringify(bodyObj);
      const up = await fetchUpstreamParticipantPath(`/v1/participant/task?${qs}`, {
        method: "POST",
        platformUserId: userId,
        body: payload,
      });
      sendParticipantUpstream(res, up);
    })();
  });

  /** Пакет реферальных кодов для задания «пригласить» + ЛС от создателя с шаблоном. */
  app.post("/api/edge/participant/ping-invite-pack", requireAuth, (req: Request, res: Response) => {
    void handlePostPingInvitePack(req, res);
  });

  app.post("/api/edge/participant/follow-reward", requireAuth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const payload =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? JSON.stringify(req.body)
          : JSON.stringify({});
      const up = await fetchUpstreamParticipantPath(`/v1/participant/follow-reward`, {
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
      const base = getEdgeUpstreamBase();
      if (!base) {
        res.status(503).json({ error: "edge_upstream_not_configured" });
        return;
      }
      const up = await fetchUpstreamParticipantPath(`/v1/creator/campaigns`, {
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
        method: "POST",
        platformUserId: userId,
        body: payload,
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
        method: "PATCH",
        platformUserId: userId,
        body: payload,
      });
      sendParticipantUpstream(res, up);
    })();
  });
}
