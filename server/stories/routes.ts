import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import * as storiesService from "./service";

export function registerStoriesRoutes(app: Express): void {
  app.get("/api/users/:userId/stories", async (req: Request, res: Response) => {
    const userIdParam = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const viewerId = getUserId(req);
    if (!userIdParam) {
      res.status(400).json({ message: "userId required" });
      return;
    }
    try {
      const list = await storiesService.listStoriesByUserIdOrPublicId(userIdParam, viewerId);
      res.json(list);
    } catch (e) {
      console.error("Stories list error:", e);
      res.status(500).json({ message: "Ошибка загрузки сториз" });
    }
  });

  app.post("/api/stories", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { mediaUrl, thumbnailUrl, expiresInHours } = req.body ?? {};
    const media = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
    if (!media) {
      res.status(400).json({ message: "Укажите mediaUrl" });
      return;
    }
    try {
      const result = await storiesService.createStory(
        userId,
        media,
        typeof thumbnailUrl === "string" ? thumbnailUrl.trim() || null : null,
        expiresInHours,
      );
      res.status(201).json(result);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Create story error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось создать сториз" });
    }
  });

  app.post("/api/stories/:id/view", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const storyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!storyId) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      await storiesService.recordStoryView(storyId, viewerId);
      res.json({ ok: true });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Story view error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Ошибка" });
    }
  });

  app.get("/api/stories/archive", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const list = await storiesService.listArchivedStories(userId);
      res.json(list);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Stories archive error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось загрузить архив сториз" });
    }
  });

  app.get("/api/stories/:id/viewers", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const storyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!storyId) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const list = await storiesService.listStoryViewers(storyId, viewerId);
      res.json(list);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Story viewers list error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось загрузить просмотры сториз" });
    }
  });

  app.get("/api/stories/feed", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    try {
      const list = await storiesService.getStoriesFeed(viewerId);
      res.json(list);
    } catch (e) {
      console.error("Stories feed error:", e);
      res.status(500).json({ message: "Ошибка загрузки ленты сторис" });
    }
  });

  app.delete("/api/stories/:id", requireAuth, async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = getUserId(req)!;
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      await storiesService.deleteOwnStory(id, userId);
      res.status(204).end();
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Delete story error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось удалить сториз" });
    }
  });

  app.patch("/api/stories/:id/archive", requireAuth, async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = getUserId(req)!;
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      await storiesService.archiveOwnStory(id, userId);
      res.json({ ok: true });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Archive story error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось архивировать сториз" });
    }
  });

  app.post("/api/stories/:id/likes", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const storyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!storyId) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const result = await storiesService.likeStory(storyId, userId);
      res.status(201).json(result);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Story like error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось поставить лайк" });
    }
  });

  app.delete("/api/stories/:id/likes", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const storyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!storyId) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const result = await storiesService.unlikeStory(storyId, userId);
      res.json(result);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error("Story unlike error:", e);
      res.status(err.status ?? 500).json({ message: err.message ?? "Не удалось убрать лайк" });
    }
  });
}
