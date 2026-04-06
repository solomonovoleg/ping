import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { HelpPagesError, getHelpPageBySlug, listHelpPagesPublic } from "./service";

function respondErr(res: Response, e: unknown): boolean {
  if (e instanceof HelpPagesError) {
    res.status(e.status).json({ message: e.message });
    return true;
  }
  return false;
}

export function registerHelpPagesRoutes(app: Express): void {
  /** Список справок (для меню в настройках) — только авторизованным */
  app.get("/api/help/pages", requireAuth, async (_req: Request, res: Response) => {
    try {
      const pages = await listHelpPagesPublic();
      res.json({ pages });
    } catch (e) {
      console.error("[help/pages]", e);
      res.status(500).json({ message: "Не удалось загрузить список" });
    }
  });

  app.get("/api/help/pages/:slug", requireAuth, async (req: Request, res: Response) => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    try {
      const page = await getHelpPageBySlug(slug);
      if (!page) {
        res.status(404).json({ message: "Страница не найдена" });
        return;
      }
      res.json(page);
    } catch (e) {
      if (respondErr(res, e)) return;
      console.error("[help/pages/:slug]", e);
      res.status(500).json({ message: "Не удалось загрузить страницу" });
    }
  });
}
