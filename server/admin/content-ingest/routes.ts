import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { writeAuditLog } from "../audit";
import {
  getContentIngestState,
  runContentIngestNow,
  startContentIngestPoller,
  updateContentIngestConfig,
} from "../../content-ingest/service";

type ReqWithAdmin = Request & { adminUserId: string };

export function registerAdminContentIngestRoutes(app: Express): void {
  startContentIngestPoller();

  app.get("/api/admin/content-ingest", (_req: Request, res: Response) => {
    res.json(getContentIngestState());
  });

  app.patch("/api/admin/content-ingest", async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as ReqWithAdmin).adminUserId;
      const nextConfig = updateContentIngestConfig(req.body ?? {});
      await writeAuditLog({
        adminId: adminUserId,
        action: "parser.config.update",
        targetType: "content-ingest",
        details: { config: nextConfig },
        ip: req.ip,
      });
      res.json({ config: nextConfig, status: getContentIngestState().status });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Не удалось обновить настройки парсера",
      });
    }
  });

  app.post("/api/admin/content-ingest/run", async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as ReqWithAdmin).adminUserId;
      const result = await runContentIngestNow("manual");
      await writeAuditLog({
        adminId: adminUserId,
        action: "parser.run",
        targetType: "content-ingest",
        details: result,
        ip: req.ip,
      });
      res.json({ ...result, state: getContentIngestState() });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Ошибка запуска парсера",
      });
    }
  });

  app.get("/api/admin/content-ingest/users", async (req: Request, res: Response) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const result = await storage.listUsersForAdmin({
        limit,
        offset: 0,
        search,
        includeDeleted: false,
      });

      const users = result.users
        .filter((u) => !u.isBlocked && !u.deletedAt)
        .map((u) => ({
          id: u.id,
          publicId: u.publicId,
          displayName: u.displayName,
          surname: u.surname,
        }));

      res.json({ users });
    } catch (error) {
      console.error("admin content-ingest users", error);
      res.status(500).json({ message: "Не удалось загрузить пользователей" });
    }
  });
}

