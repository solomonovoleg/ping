import type { Express } from "express";
import { requireAdmin } from "./middleware";
import { registerAdminDashboardRoutes } from "./dashboard/routes";
import { registerAdminUsersRoutes } from "./users/routes";
import { registerAdminAdminsRoutes } from "./admins/routes";
import { registerAdminAuditRoutes } from "./audit/routes";
import { registerAdminFeedRoutes } from "./feed/routes";
import { registerAdminReferralRoutes } from "./referrals/routes";

export function registerAdminRoutes(app: Express): void {
  app.use("/api/admin", requireAdmin);
  registerAdminDashboardRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminAdminsRoutes(app);
  registerAdminAuditRoutes(app);
  registerAdminFeedRoutes(app);
  registerAdminReferralRoutes(app);
}
