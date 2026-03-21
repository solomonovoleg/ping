import type { Express, Request, Response } from "express";
import { writeAuditLog } from "../audit";
import { requireAdminOrSuper } from "../middleware";
import { opsStrings } from "./i18n.ru";
import { invalidateApiShieldSettingsCache } from "../../middleware/api-shield";
import { platformGetPublic, platformUpdate } from "./platform.repo";

type ReqAdmin = Request & { adminUserId: string; adminRole: string };

export function registerOpsPlatformAdminRoutes(app: Express): void {
  app.get("/api/admin/ops/platform", async (_req: Request, res: Response) => {
    try {
      const p = await platformGetPublic();
      res.json(p);
    } catch {
      res.status(500).json({ message: opsStrings.platformLoadError });
    }
  });

  app.patch("/api/admin/ops/platform", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqAdmin).adminUserId;
    try {
      const body = req.body ?? {};
      const patch: Parameters<typeof platformUpdate>[0] = {};
      if (typeof body.bannerEnabled === "boolean") patch.bannerEnabled = body.bannerEnabled;
      if (typeof body.bannerText === "string") patch.bannerText = body.bannerText;
      if (body.bannerVariant === "info" || body.bannerVariant === "warning" || body.bannerVariant === "danger") {
        patch.bannerVariant = body.bannerVariant;
      }
      if (typeof body.maintenanceMode === "boolean") patch.maintenanceMode = body.maintenanceMode;
      if (typeof body.strictApiShield === "boolean") patch.strictApiShield = body.strictApiShield;
      const next = await platformUpdate(patch);
      invalidateApiShieldSettingsCache();
      await writeAuditLog({
        adminId: adminUserId,
        action: "ops.platform.update",
        details: patch,
        ip: req.ip,
      });
      res.json({ ...next, message: opsStrings.platformSaved });
    } catch (e) {
      console.error("ops platform patch", e);
      res.status(500).json({ message: opsStrings.platformSaveError });
    }
  });
}
