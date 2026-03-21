import type { Express } from "express";
import { registerOpsAuditRoutes } from "../ops/audit-http";

export function registerAdminAuditRoutes(app: Express): void {
  registerOpsAuditRoutes(app);
}
