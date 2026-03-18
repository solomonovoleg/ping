import type { Express, Request, Response } from "express";
import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { adminAuditLog } from "@shared/schema";

export function registerAdminAuditRoutes(app: Express): void {
  app.get("/api/admin/audit-log", async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const list = await db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit)
        .offset(offset);
      res.json(list);
    } catch {
      res.json([]);
    }
  });
}
