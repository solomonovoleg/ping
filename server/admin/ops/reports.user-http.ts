import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../../auth/session";
import type { ContentReportTargetType } from "@shared/schema/content-reports";
import {
  ReportsTargetValidationError,
  validateReportTarget,
} from "../../reports/validate-report-target/validate-report-target";
import { allowContentReportForUser } from "../../reports/content-report-rate-limit/content-report-rate-limit";
import { parseContentReportReason } from "../../reports/parse-content-report-reason/parse-content-report-reason";
import { opsStrings } from "./i18n.ru";
import { isValidReportTargetType } from "./is-valid-report-target";
import { reportsCreate } from "./reports.repo";

export function registerOpsUserReportsRoute(app: Express): void {
  app.post("/api/reports", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const targetType = typeof req.body?.targetType === "string" ? req.body.targetType.trim() : "";
    const targetId = typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
    const rawCtxPost = typeof req.body?.contextPostId === "string" ? req.body.contextPostId.trim().slice(0, 128) : "";
    const rawCtxChat = typeof req.body?.contextChatId === "string" ? req.body.contextChatId.trim().slice(0, 128) : "";
    const parsedReason = parseContentReportReason(req.body);
    if (!parsedReason.ok) {
      const msg =
        parsedReason.key === "reportBadReasonCode"
          ? opsStrings.reportBadReasonCode
          : parsedReason.key === "reportOtherNeedsDetails"
            ? opsStrings.reportOtherNeedsDetails
            : opsStrings.reportLegacyReasonTooShort;
      res.status(400).json({ message: msg });
      return;
    }
    const { reasonText, reasonCode } = parsedReason.value;
    if (!isValidReportTargetType(targetType) || !targetId) {
      res.status(400).json({ message: opsStrings.reportBadTarget });
      return;
    }
    if (!allowContentReportForUser(userId)) {
      res.status(429).json({ message: opsStrings.reportRateLimited });
      return;
    }
    const contextPostId = targetType === "comment" && rawCtxPost ? rawCtxPost : undefined;
    const contextChatId = targetType === "message" && rawCtxChat ? rawCtxChat : undefined;
    try {
      await validateReportTarget(userId, targetType as ContentReportTargetType, targetId, {
        contextPostId,
        contextChatId,
      });
      const { id, duplicate } = await reportsCreate({
        reporterUserId: userId,
        targetType,
        targetId,
        reason: reasonText,
        reasonCode,
        contextPostId,
        contextChatId,
      });
      const msg = duplicate ? opsStrings.reportDuplicateAck : opsStrings.reportCreated;
      res.status(duplicate ? 200 : 201).json({
        id,
        message: msg,
        duplicate,
      });
    } catch (e) {
      if (e instanceof ReportsTargetValidationError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error("reports create", e);
      res.status(500).json({ message: opsStrings.reportCreateError });
    }
  });
}
