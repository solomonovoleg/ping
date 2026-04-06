import type { Express, Request, Response } from "express";
import {
  countMediaStudioPublishedSince,
  countNewUsersSince,
  countOpenReportsSince,
  parseNavBadgeSinceQuery,
} from "./nav-badges.repo";

export function registerAdminNavBadgeRoutes(app: Express): void {
  app.get("/api/admin/nav-badge-counts", async (req: Request, res: Response) => {
    try {
      const q = req.query as Record<string, unknown>;
      const { usersSince, mediaSince, reportsSince } = parseNavBadgeSinceQuery(q);
      const [newUsers, mediaStudioPublished, openReports] = await Promise.all([
        countNewUsersSince(usersSince),
        countMediaStudioPublishedSince(mediaSince),
        countOpenReportsSince(reportsSince),
      ]);
      res.json({
        newUsers,
        mediaStudioPublished,
        openReports,
      });
    } catch (e) {
      console.error("admin nav-badge-counts", e);
      res.status(500).json({ message: "Не удалось загрузить счётчики меню" });
    }
  });
}
