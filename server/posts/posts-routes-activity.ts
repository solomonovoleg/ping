import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { recordPostEngagement, recordPostView } from "./service";
import { postsRoutePostId } from "./posts-route-helpers";
import { resolveCanonicalPostId } from "./resolve-post-ref";

export function registerPostsViewEngageRoutes(app: Express): void {
  app.post("/api/posts/:postId/view", requireAuth, async (req: Request, res: Response) => {
    const postId = postsRoutePostId(req);
    const userId = getUserId(req)!;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const canonical = await resolveCanonicalPostId(postId);
      if (!canonical) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      await recordPostView(canonical, userId);
      const { scheduleEdgeTaskAfterPostAction } = await import("./edge-task-hook");
      scheduleEdgeTaskAfterPostAction(userId, canonical, "view_post");
      res.status(204).end();
    } catch (e) {
      console.error("Post view error:", e);
      res.status(500).json({ message: "Ошибка записи просмотра" });
    }
  });

  app.post("/api/posts/:postId/engage", requireAuth, async (req: Request, res: Response) => {
    const postId = postsRoutePostId(req);
    const userId = getUserId(req)!;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    const rawDwellMs = Number(req.body?.dwellMs);
    const dwellMs = Number.isFinite(rawDwellMs) && rawDwellMs > 0 ? Math.min(rawDwellMs, 60_000) : undefined;
    const expanded = req.body?.expanded === true;
    const readFull = req.body?.readFull === true;
    try {
      const canonical = await resolveCanonicalPostId(postId);
      if (!canonical) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      await recordPostEngagement(canonical, userId, { dwellMs, expanded, readFull });
      res.status(204).end();
    } catch (e) {
      console.error("Post engagement error:", e);
      res.status(500).json({ message: "Ошибка записи engagement" });
    }
  });
}
