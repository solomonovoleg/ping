import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { createUserSlidingRateLimit } from "../middleware/create-user-sliding-rate-limit";
import { parseNonNegativeIntQuery, parsePositiveIntQuery } from "../http/parse-positive-int-query";
import { sendStoriesRouteError } from "./stories-http-error/stories-http-error";
import * as storiesService from "./service";

const STORIES_NO_STORE = "private, no-store, max-age=0";

export function registerStoriesRoutes(app: Express): void {
  const createStoryRateLimit = createUserSlidingRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Слишком много сторис за короткое время",
  });

  app.get("/api/users/:userId/stories", requireAuth, async (req: Request, res: Response) => {
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
      sendStoriesRouteError(res, e, "Ошибка загрузки сториз");
    }
  });

  app.post("/api/stories", requireAuth, createStoryRateLimit, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { mediaUrl, thumbnailUrl, expiresInHours, caption } = req.body ?? {};
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
        typeof caption === "string" ? caption : null,
      );
      res.status(201).json(result);
    } catch (e) {
      sendStoriesRouteError(res, e, "Не удалось создать сториз");
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
      sendStoriesRouteError(res, e, "Ошибка записи просмотра");
    }
  });

  app.get("/api/stories/archive", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const list = await storiesService.listArchivedStories(userId);
      res.json(list);
    } catch (e) {
      sendStoriesRouteError(res, e, "Не удалось загрузить архив сториз");
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
      sendStoriesRouteError(res, e, "Не удалось загрузить просмотры сториз");
    }
  });

  app.get("/api/stories/feed", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const limit = parsePositiveIntQuery(req.query.limit, 18, 40);
    const offset = parseNonNegativeIntQuery(req.query.offset, 0, 10000);
    try {
      res.setHeader("Cache-Control", STORIES_NO_STORE);
      const page = await storiesService.getStoriesFeedPage(viewerId, {
        limit,
        offset,
      });
      res.json(page);
    } catch (e) {
      sendStoriesRouteError(res, e, "Ошибка загрузки ленты сторис");
    }
  });

  /** Одна сторис по id (доступ как в ленте); до динамических сегментов `…/view`, `…/likes` не дотягивается. */
  app.get("/api/stories/:id", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const story = await storiesService.getStoryByIdForViewer(viewerId, id);
      res.json(story);
    } catch (e) {
      sendStoriesRouteError(res, e, "Ошибка загрузки сториз");
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
      sendStoriesRouteError(res, e, "Не удалось удалить сториз");
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
      sendStoriesRouteError(res, e, "Не удалось архивировать сториз");
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
      sendStoriesRouteError(res, e, "Не удалось поставить лайк");
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
      sendStoriesRouteError(res, e, "Не удалось убрать лайк");
    }
  });
}
