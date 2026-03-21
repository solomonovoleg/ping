import type { Express, Request, Response } from "express";
import { platformGetPublic } from "./platform.repo";

/** Публично: баннер и режим обслуживания (кэш на клиенте) */
export function registerOpsPlatformPublicRoute(app: Express): void {
  app.get("/api/platform/announcement", async (_req: Request, res: Response) => {
    try {
      const p = await platformGetPublic();
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        banner: {
          enabled: p.bannerEnabled,
          text: p.bannerText,
          variant: p.bannerVariant,
        },
        maintenanceMode: p.maintenanceMode,
      });
    } catch {
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json({
        banner: { enabled: false, text: "", variant: "info" },
        maintenanceMode: false,
      });
    }
  });
}
