import type { Express, Request, Response } from "express";
import { storage } from "../../storage";

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
}
