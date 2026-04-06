import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { getAdminMetricHistory, getAdminMetricSnapshot } from "../metrics-collector";
import { getCallsReliabilityMetrics } from "../../calls/ws";
import { isGroupCallsServerEnabled } from "../../group-calls/flags";

const REVIEW_FEATURES = [
  "send_message",
  "open_post",
  "view_stories",
  "open_profile",
  "make_call",
] as const;

function extractUsersTotalFromStats(stats: unknown): number | null {
  if (!stats || typeof stats !== "object") return null;
  const shape = stats as Record<string, unknown>;
  if (typeof shape.usersTotal === "number") return shape.usersTotal;
  if (typeof shape.total === "number") return shape.total;
  return null;
}

export function registerAdminDashboardRoutes(app: Express): void {
  app.get("/api/admin/dashboard/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (e) {
      console.error("admin dashboard stats", e);
      res.status(500).json({ message: "Ошибка загрузки статистики" });
    }
  });

  /** Регистрации по дням + история нагрузки/онлайн (снимки раз в 5 мин, текущее — live) */
  app.get("/api/admin/dashboard/analytics", async (req: Request, res: Response) => {
    try {
      const daysRaw = req.query.days;
      const parsed = typeof daysRaw === "string" ? parseInt(daysRaw, 10) : 14;
      const days = Number.isFinite(parsed) ? parsed : 14;
      const registrationsByDay = await storage.getUserRegistrationsByDay(days);
      res.json({
        registrationsByDay,
        serverMetrics: {
          current: getAdminMetricSnapshot(),
          history: getAdminMetricHistory(),
        },
        callsReliability: getCallsReliabilityMetrics(),
        metricsNote:
          "Онлайн — пользователи с активным WebSocket /calls. История точек — каждые 5 минут после старта процесса. callsReliability — счетчики переходов и причин закрытия /calls WS.",
      });
    } catch (e) {
      console.error("admin dashboard analytics", e);
      res.status(500).json({ message: "Ошибка загрузки аналитики" });
    }
  });

  /** Быстрый статус готовности core фич для ревью (App Store / Google Play). */
  app.get("/api/admin/dashboard/review-readiness", async (_req: Request, res: Response) => {
    try {
      const [stats, callsReliability] = await Promise.all([
        storage.getAdminStats(),
        Promise.resolve(getCallsReliabilityMetrics()),
      ]);
      const usersTotal = extractUsersTotalFromStats(stats);
      const hasUsers = typeof usersTotal === "number" ? usersTotal > 0 : false;
      const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
      const callsSignalingEnabled = hasDatabaseUrl;
      const groupCallsEnabled = isGroupCallsServerEnabled();
      const checks = {
        send_message: hasDatabaseUrl && hasUsers,
        open_post: hasDatabaseUrl,
        view_stories: hasDatabaseUrl,
        open_profile: hasDatabaseUrl,
        make_call: callsSignalingEnabled,
      };
      res.json({
        ready: Object.values(checks).every(Boolean),
        checks,
        features: REVIEW_FEATURES,
        stats: { usersTotal },
        environment: {
          hasDatabaseUrl,
          groupCallsEnabled,
          callsSignalingEnabled,
        },
        callsReliability,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("admin dashboard review-readiness", e);
      res.status(500).json({
        message: "Не удалось собрать review-readiness",
        code: "admin_review_readiness_error",
      });
    }
  });
}
