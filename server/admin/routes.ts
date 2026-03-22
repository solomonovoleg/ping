import type { Express } from "express";
import { requireAdmin } from "./middleware";
import { registerAdminDashboardRoutes } from "./dashboard/routes";
import { registerAdminUsersRoutes } from "./users/routes";
import { registerAdminAdminsRoutes } from "./admins/routes";
import { registerAdminAuditRoutes } from "./audit/routes";
import { registerAdminFeedRoutes } from "./feed/routes";
import { registerAdminReferralRoutes } from "./referrals/routes";
import { registerAdminContentIngestRoutes } from "./content-ingest/routes";
import { registerOpsPlatformAdminRoutes } from "./ops/platform.admin-http";
import { registerOpsReportsAdminRoutes } from "./ops/reports.admin-http";
import { registerOpsTrafficShieldAdminRoutes } from "./ops/traffic-shield.admin-http";
import { registerOpsDiskAdminRoutes } from "./ops/disk.admin-http";
import { registerAdminModulesTelemetryRoutes } from "./telemetry/modules.admin-http";

export function registerAdminRoutes(app: Express): void {
  app.use("/api/admin", requireAdmin);
  registerAdminDashboardRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminAdminsRoutes(app);
  registerAdminAuditRoutes(app);
  registerOpsPlatformAdminRoutes(app);
  registerOpsReportsAdminRoutes(app);
  registerOpsTrafficShieldAdminRoutes(app);
  registerOpsDiskAdminRoutes(app);
  registerAdminModulesTelemetryRoutes(app);
  registerAdminFeedRoutes(app);
  registerAdminReferralRoutes(app);
  registerAdminContentIngestRoutes(app);
}
