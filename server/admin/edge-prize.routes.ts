import type { Express, Request, Response } from "express";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import { fetchUpstreamEdgeServicePath, getEdgeUpstreamBase } from "../edge/upstream-client";
import { notifyPrizeDrawWinners, resolvePrizeDmSenderId } from "../edge/prize-draw-notify";

type DrawPayload = {
  edgeId: string;
  campaignTitle: string;
  drawBatchId: string;
  creatorPlatformUserId: string | null;
  giftKey: string;
  giftLabel: string;
  poolSize: number;
  requestedCount: number;
  drawnCount: number;
  winners: { platformUserId: string; giftKey: string; giftLabel: string }[];
  winnerDm?: { text: string; mediaUrl: string | null } | null;
};

/**
 * Розыгрыш приза EDGE: прокси на микросервис + опционально ЛС **только** строкам из `winners` в ответе
 * (никакой рассылки мимо списка победителей). Отправитель: создатель кампании или EDGE_PRIZE_NOTIFY_USER_ID.
 */
export function registerAdminEdgePrizeRoutes(app: Express): void {
  app.post("/api/admin/edge/draw-prize", noStorePrivateJson, async (req: Request, res: Response) => {
    try {
      const edgeId = String(req.body?.edgeId ?? "").trim();
      if (!edgeId) {
        res.status(400).json({ message: "Укажите edgeId кампании" });
        return;
      }
      if (!getEdgeUpstreamBase()) {
        res.status(503).json({ message: "EDGE_UPSTREAM_URL не настроен" });
        return;
      }
      const b = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      const giftKey = b.giftKey !== undefined && b.giftKey !== null ? String(b.giftKey) : undefined;
      const count = b.count !== undefined && b.count !== null ? Number(b.count) : undefined;
      const notify = b.notify !== false;

      const up = await fetchUpstreamEdgeServicePath("/v1/campaign/draw", {
        method: "POST",
        body: JSON.stringify({
          edgeId,
          giftKey,
          count,
          ...(b.pool === "top" || b.pool === "all" ? { pool: b.pool } : {}),
          ...(b.method === "first" || b.method === "random" ? { method: b.method } : {}),
          ...(b.topN !== undefined && b.topN !== null ? { topN: Number(b.topN) } : {}),
          ...(b.rankingKind === "primary" || b.rankingKind === "secondary"
            ? { rankingKind: b.rankingKind }
            : {}),
          ...(b.rankingScope === "primary" || b.rankingScope === "secondary"
            ? { rankingScope: b.rankingScope }
            : {}),
        }),
      });
      if (!up.ok) {
        res.status(503).json({ message: "Не удалось связаться с EDGE" });
        return;
      }
      if (up.status < 200 || up.status >= 300) {
        res.status(up.status).type("application/json").send(up.body);
        return;
      }

      let payload: DrawPayload;
      try {
        payload = JSON.parse(up.body) as DrawPayload;
      } catch {
        res.status(502).json({ message: "Некорректный ответ EDGE" });
        return;
      }

      let dmResults: { platformUserId: string; ok: boolean; error?: string }[] = [];
      const senderId = notify ? resolvePrizeDmSenderId(payload.creatorPlatformUserId) : null;

      if (notify && senderId && payload.winners?.length) {
        dmResults = await notifyPrizeDrawWinners({
          senderId,
          payload: {
            campaignTitle: payload.campaignTitle,
            giftLabel: payload.giftLabel,
            winners: payload.winners,
            winnerDm: payload.winnerDm,
            drawnCount: payload.drawnCount,
          },
        });
      }

      const attempted = Boolean(notify && payload.winners?.length);
      res.status(201).json({
        ...payload,
        notifications: {
          attempted: attempted && Boolean(senderId),
          senderUserId: senderId,
          skippedReason:
            notify && attempted && !senderId
              ? "Задайте creator_platform_user_id в edge_campaigns или EDGE_PRIZE_NOTIFY_USER_ID"
              : undefined,
          results: dmResults,
        },
      });
    } catch (e) {
      console.error("[admin/edge/draw-prize]", e);
      res.status(500).json({ message: "Ошибка розыгрыша" });
    }
  });
}
