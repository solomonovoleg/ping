import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { parseNonNegativeIntQuery, parsePositiveIntQuery } from "../http/parse-positive-int-query";
import { getPostByIdDetailed, listPostsForViewer, listSavedPostsDetailed, PostsServiceError } from "./service";
import { postsRoutePostId } from "./posts-route-helpers";

/** GET /api/posts и GET /api/posts/:postId (до маршрутов с суффиксами под :postId). */
export function registerPostsFeedRoutes(app: Express): void {
  app.get("/api/posts", requireAuth, async (req: Request, res: Response) => {
    const authorId = typeof req.query.authorId === "string" ? req.query.authorId.trim() : undefined;
    const hashtagParam =
      typeof req.query.hashtag === "string" ? req.query.hashtag.trim().toLowerCase().replace(/^#/, "") : undefined;
    const qParam = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const videoOnlyRaw = req.query.videoOnly ?? req.query.video_only;
    const videoOnly =
      videoOnlyRaw === "1" ||
      videoOnlyRaw === "true" ||
      (typeof videoOnlyRaw === "string" && videoOnlyRaw.toLowerCase() === "yes");
    const limit = parsePositiveIntQuery(req.query.limit, 50, 100);
    const offset = parseNonNegativeIntQuery(req.query.offset, 0, 10000);
    const viewerId = getUserId(req)!;
    try {
      const list = await listPostsForViewer({
        authorId,
        hashtagParam,
        qParam,
        videoOnly,
        limit,
        offset,
        viewerId,
      });
      res.json(list);
    } catch (e) {
      console.error("Posts list error:", e);
      const rawMessage = e instanceof Error ? e.message : "";
      const isInfraIssue =
        rawMessage.includes("relation") && rawMessage.includes("does not exist") || rawMessage.includes("DATABASE_URL");
      if (isInfraIssue) {
        res.status(503).json({
          message: "Сервис постов временно недоступен",
          code: "posts_service_unavailable",
          retryable: true,
        });
        return;
      }
      res.status(500).json({ message: "Ошибка загрузки ленты", code: "posts_internal_error", retryable: true });
    }
  });

  app.get("/api/posts/:postId", async (req: Request, res: Response) => {
    const postId = postsRoutePostId(req);
    const viewerId = getUserId(req);
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const payload = await getPostByIdDetailed(postId, viewerId ?? null);
      res.json(payload);
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message, code: "posts_error", retryable: e.status >= 500 });
        return;
      }
      console.error("Get post error:", e);
      res.status(500).json({ message: "Ошибка загрузки поста", code: "posts_internal_error", retryable: true });
    }
  });
}

export function registerPostsSavedListRoute(app: Express): void {
  app.get("/api/me/saved-posts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = parsePositiveIntQuery(req.query.limit, 50, 100);
    const offset = parseNonNegativeIntQuery(req.query.offset, 0, 10000);
    try {
      const list = await listSavedPostsDetailed(userId, limit, offset);
      res.json(list);
    } catch (e) {
      console.error("Saved posts list error:", e);
      res.status(500).json({ message: "Ошибка загрузки сохранённого", code: "posts_internal_error", retryable: true });
    }
  });
}
