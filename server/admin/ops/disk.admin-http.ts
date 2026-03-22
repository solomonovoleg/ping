import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getPool } from "../../db/client";
import { computeDiskOpsReport } from "./disk-stats.service";

function tryGetPool(): Pool | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getPool();
  } catch {
    return null;
  }
}

export function registerOpsDiskAdminRoutes(app: Express): void {
  app.get("/api/admin/ops/disk", async (_req: Request, res: Response) => {
    try {
      const report = await computeDiskOpsReport(tryGetPool());
      res.setHeader("Cache-Control", "no-store");
      res.json(report);
    } catch (e) {
      console.error("ops disk", e);
      res.status(500).json({ message: "Не удалось собрать статистику диска" });
    }
  });
}
