import type { Express, Request, Response } from "express";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import { fetchUpstreamEdgeServicePath, getEdgeUpstreamBase } from "../edge/upstream-client";
import { sendChatMessage, MessagesServiceError } from "../messages/service";
import { storage } from "../storage";

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
};

function notifySenderId(creatorId: string | null | undefined): string | null {
  const c = typeof creatorId === "string" ? creatorId.trim() : "";
  if (c) return c;
  const fb = process.env.EDGE_PRIZE_NOTIFY_USER_ID?.trim();
  return fb && fb.length > 0 ? fb : null;
}

/**
 * Розыгрыш приза EDGE: прокси на микросервис + опционально ЛС победителям от создателя кампании
 * (creator_platform_user_id в EDGE) или EDGE_PRIZE_NOTIFY_USER_ID.
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
      const giftKey = req.body?.giftKey !== undefined && req.body?.giftKey !== null
        ? String(req.body.giftKey)
        : undefined;
      const count = req.body?.count !== undefined && req.body?.count !== null ? Number(req.body.count) : undefined;
      const notify = req.body?.notify !== false;

      const up = await fetchUpstreamEdgeServicePath("/v1/campaign/draw", {
        method: "POST",
        body: JSON.stringify({ edgeId, giftKey, count }),
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

      const dmResults: { platformUserId: string; ok: boolean; error?: string }[] = [];
      const senderId = notify ? notifySenderId(payload.creatorPlatformUserId) : null;

      if (notify && senderId && payload.winners?.length) {
        for (const w of payload.winners) {
          const text = [
            "🎉 Поздравляем!",
            `Вы выиграли приз в кампании «${payload.campaignTitle}»: ${w.giftLabel}.`,
            "Свяжитесь с организатором для получения награды.",
          ].join("\n");
          try {
            const chat = await storage.getOrCreateDmChat(senderId, w.platformUserId);
            await sendChatMessage({
              userId: senderId,
              chatId: chat.id,
              content: text,
              type: "text",
            });
            dmResults.push({ platformUserId: w.platformUserId, ok: true });
          } catch (e) {
            const msg = e instanceof MessagesServiceError ? e.message : "send_failed";
            console.error("[admin/edge/draw-prize] dm", w.platformUserId, e);
            dmResults.push({ platformUserId: w.platformUserId, ok: false, error: msg });
          }
        }
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
