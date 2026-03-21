/**
 * Админ-API: снимок телеметрии по модулям (отдельно от dashboard / traffic-shield).
 */
import type { Express, Request, Response } from "express";
import { getModulesTelemetryPayload } from "./api-traffic-store";

export function registerAdminModulesTelemetryRoutes(app: Express): void {
  app.get("/api/admin/modules-telemetry", (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(getModulesTelemetryPayload());
    } catch (e) {
      console.error("modules-telemetry", e);
      res.status(500).json({ message: "Не удалось собрать метрики модулей" });
    }
  });
}
