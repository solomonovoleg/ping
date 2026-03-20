import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { getAdminMetricHistory, getAdminMetricSnapshot } from "../metrics-collector";

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
        metricsNote:
          "Онлайн — пользователи с активным WebSocket /calls. История точек — каждые 5 минут после старта процесса.",
      });
    } catch (e) {
      console.error("admin dashboard analytics", e);
      res.status(500).json({ message: "Ошибка загрузки аналитики" });
    }
  });
}
