import type { Express, Request, Response } from "express";
import { getTrafficShieldAdminPayload } from "../../middleware/api-shield";
import { platformGetPublic } from "./platform.repo";

export function registerOpsTrafficShieldAdminRoutes(app: Express): void {
  app.get("/api/admin/ops/traffic-shield", async (_req: Request, res: Response) => {
    try {
      const p = await platformGetPublic();
      const base = getTrafficShieldAdminPayload();
      res.json({ ...base, strictApiShield: p.strictApiShield });
    } catch (e) {
      console.error("ops traffic-shield", e);
      res.status(500).json({ message: "Не удалось загрузить метрики трафика" });
    }
  });
}
