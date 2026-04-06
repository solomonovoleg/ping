import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { savePost, sharePostToUser, unsavePost, PostsServiceError } from "./service";
import { postsRoutePostId } from "./posts-route-helpers";

export function registerPostsShareSaveRoutes(app: Express): void {
  app.post("/api/posts/:postId/share", requireAuth, async (req: Request, res: Response) => {
    const postId = postsRoutePostId(req);
    const userId = getUserId(req)!;
    const toUserId = typeof req.body?.toUserId === "string" ? req.body.toUserId.trim() : "";
    if (!postId || !toUserId) {
      res.status(400).json({ message: "Укажите postId и toUserId" });
      return;
    }
    try {
      const payload = await sharePostToUser(postId, userId, toUserId);
      res.status(201).json(payload);
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error("Share post error:", e);
      res.status(500).json({ message: "Не удалось отправить пост" });
    }
  });

  app.post("/api/posts/:postId/save", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = postsRoutePostId(req);
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      await savePost(userId, postId);
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error("Save post error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });

  app.delete("/api/posts/:postId/save", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = postsRoutePostId(req);
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      await unsavePost(userId, postId);
      res.json({ ok: true });
    } catch (e) {
      console.error("Unsave post error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });
}
