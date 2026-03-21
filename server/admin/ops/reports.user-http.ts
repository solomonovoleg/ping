import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../../auth/session";
import { CONTENT_REPORT_TARGET_TYPES } from "@shared/schema/content-reports";
import { opsStrings } from "./i18n.ru";
import { reportsCreate } from "./reports.repo";

function validTarget(t: string): t is (typeof CONTENT_REPORT_TARGET_TYPES)[number] {
  return (CONTENT_REPORT_TARGET_TYPES as readonly string[]).includes(t);
}

export function registerOpsUserReportsRoute(app: Express): void {
  app.post("/api/reports", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const targetType = typeof req.body?.targetType === "string" ? req.body.targetType.trim() : "";
    const targetId = typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!validTarget(targetType) || !targetId || reason.length < 3) {
      res.status(400).json({ message: opsStrings.reportBadTarget });
      return;
    }
    try {
      const { id } = await reportsCreate({ reporterUserId: userId, targetType, targetId, reason });
      res.status(201).json({ id, message: opsStrings.reportCreated });
    } catch (e) {
      console.error("reports create", e);
      res.status(500).json({ message: opsStrings.reportCreateError });
    }
  });
}
