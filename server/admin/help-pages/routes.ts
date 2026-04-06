import type { Express, Request, Response } from "express";
import { requireAdmin } from "../middleware";
import {
  HelpPagesError,
  createHelpPage,
  listHelpPagesAdmin,
  updateHelpPageBySlug,
} from "../../help-pages/service";

function respondErr(res: Response, e: unknown): boolean {
  if (e instanceof HelpPagesError) {
    res.status(e.status).json({ message: e.message });
    return true;
  }
  return false;
}

export function registerAdminHelpPagesRoutes(app: Express): void {
  app.get("/api/admin/help-pages", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const pages = await listHelpPagesAdmin();
      res.json({ pages });
    } catch (e) {
      console.error("[admin/help-pages]", e);
      res.status(500).json({ message: "Не удалось загрузить страницы" });
    }
  });

  app.post("/api/admin/help-pages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const row = await createHelpPage({
        slug: typeof req.body?.slug === "string" ? req.body.slug : "",
        title: typeof req.body?.title === "string" ? req.body.title : "",
        body: typeof req.body?.body === "string" ? req.body.body : "",
        sortOrder: typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined,
      });
      res.status(201).json(row);
    } catch (e) {
      if (respondErr(res, e)) return;
      console.error("[admin/help-pages POST]", e);
      res.status(500).json({ message: "Не удалось создать страницу" });
    }
  });

  app.patch("/api/admin/help-pages/:slug", requireAdmin, async (req: Request, res: Response) => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    try {
      const row = await updateHelpPageBySlug(slug, req.body ?? {});
      if (!row) {
        res.status(404).json({ message: "Страница не найдена" });
        return;
      }
      res.json(row);
    } catch (e) {
      if (respondErr(res, e)) return;
      console.error("[admin/help-pages PATCH]", e);
      res.status(500).json({ message: "Не удалось сохранить" });
    }
  });
}
