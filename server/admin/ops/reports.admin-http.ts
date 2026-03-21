import type { Express, Request, Response } from "express";
import { writeAuditLog } from "../audit";
import { requireAdminOrSuper } from "../middleware";
import type { ContentReportStatus } from "@shared/schema/content-reports";
import { opsStrings } from "./i18n.ru";
import { reportsListForAdmin, reportsSetStatus } from "./reports.repo";

type ReqAdmin = Request & { adminUserId: string };

function isStatus(s: string): s is ContentReportStatus {
  return s === "resolved" || s === "dismissed";
}

export function registerOpsReportsAdminRoutes(app: Express): void {
  app.get("/api/admin/ops/reports", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 40, 100);
      const offset = Number(req.query.offset) || 0;
      const st = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const status =
        st === "open" || st === "resolved" || st === "dismissed" ? (st as ContentReportStatus) : undefined;
      const { items, total } = await reportsListForAdmin({ status, limit, offset });
      res.json({
        reports: items.map((r) => ({
          id: r.id,
          reporterUserId: r.reporterUserId,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          status: r.status,
          adminNote: r.adminNote,
          resolvedBy: r.resolvedBy,
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
        total,
      });
    } catch (e) {
      console.error("ops reports list", e);
      res.status(500).json({ message: opsStrings.reportsLoadError });
    }
  });

  app.patch("/api/admin/ops/reports/:id", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqAdmin).adminUserId;
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
    const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote : undefined;
    if (!id || !isStatus(status)) {
      res.status(400).json({ message: opsStrings.reportResolveError });
      return;
    }
    try {
      const ok = await reportsSetStatus(id, status, adminUserId, adminNote);
      if (!ok) {
        res.status(404).json({ message: opsStrings.reportNotFound });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: status === "resolved" ? "ops.report.resolve" : "ops.report.dismiss",
        targetType: "content_report",
        targetId: id,
        details: { adminNote },
        ip: req.ip,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("ops reports patch", e);
      res.status(500).json({ message: opsStrings.reportResolveError });
    }
  });
}
