import type { Express, Request, Response } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { adminAuditLog } from "@shared/schema";
import { opsStrings } from "./i18n.ru";

type ReqAdmin = Request & { adminRole?: string };

const CSV_MAX = 2000;

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function registerOpsAuditRoutes(app: Express): void {
  app.get("/api/admin/audit-log", async (req: Request, res: Response) => {
    try {
      const format = typeof req.query.format === "string" ? req.query.format.trim() : "json";
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
      const adminId = typeof req.query.adminId === "string" ? req.query.adminId.trim() : "";
      const targetType = typeof req.query.targetType === "string" ? req.query.targetType.trim() : "";
      const since = typeof req.query.since === "string" ? req.query.since.trim() : "";
      const until = typeof req.query.until === "string" ? req.query.until.trim() : "";

      const role = (req as ReqAdmin).adminRole ?? "";
      if (format === "csv" && role !== "admin" && role !== "super_admin") {
        res.status(403).json({ message: opsStrings.forbiddenSettings });
        return;
      }

      const conds = [];
      if (action) conds.push(eq(adminAuditLog.action, action));
      if (adminId) conds.push(eq(adminAuditLog.adminId, adminId));
      if (targetType) conds.push(eq(adminAuditLog.targetType, targetType));
      if (since) {
        const d = new Date(since);
        if (!Number.isNaN(d.getTime())) conds.push(gte(adminAuditLog.createdAt, d));
      }
      if (until) {
        const d = new Date(until);
        if (!Number.isNaN(d.getTime())) conds.push(lte(adminAuditLog.createdAt, d));
      }
      const whereClause = conds.length ? and(...conds) : undefined;
      const db = getDb();

      if (format === "csv") {
        const rows = whereClause
          ? await db
              .select()
              .from(adminAuditLog)
              .where(whereClause)
              .orderBy(desc(adminAuditLog.createdAt))
              .limit(CSV_MAX)
          : await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(CSV_MAX);
        const header = ["id", "createdAt", "adminId", "action", "targetType", "targetId", "ip", "details"];
        const lines = [header.join(",")];
        for (const r of rows) {
          lines.push(
            [
              csvEscape(r.id),
              csvEscape(r.createdAt.toISOString()),
              csvEscape(r.adminId),
              csvEscape(r.action),
              csvEscape(r.targetType ?? ""),
              csvEscape(r.targetId ?? ""),
              csvEscape(r.ip ?? ""),
              csvEscape(r.details ? JSON.stringify(r.details) : ""),
            ].join(",")
          );
        }
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="audit-${Date.now()}.csv"`);
        res.send("\uFEFF" + lines.join("\n"));
        return;
      }

      const list = whereClause
        ? await db
            .select()
            .from(adminAuditLog)
            .where(whereClause)
            .orderBy(desc(adminAuditLog.createdAt))
            .limit(limit)
            .offset(offset)
        : await db
            .select()
            .from(adminAuditLog)
            .orderBy(desc(adminAuditLog.createdAt))
            .limit(limit)
            .offset(offset);

      res.json(list);
    } catch (e) {
      console.error("admin audit-log", e);
      res.status(500).json({ message: opsStrings.auditLoadError });
    }
  });
}
