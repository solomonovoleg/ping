import type { Express, Request, Response } from "express";
import { getUserId } from "../../../auth/session";
import { getDb } from "../../../db";
import { assertPostReadableByViewer, PostsServiceError } from "../../../posts/service";
import { pgErrorCode } from "../shared/pg-errors";
import { queryCommentsListForPost } from "./query-comments-list";

export function registerGetPostCommentsRoute(app: Express): void {
  app.get("/api/posts/:postId/comments", async (req: Request, res: Response) => {
    const postId = req.params.postId;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const viewerId = getUserId(req) ?? null;
      await assertPostReadableByViewer(String(postId), viewerId);
      const list = await queryCommentsListForPost(getDb(), String(postId), viewerId);
      res.json(list);
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      const code = pgErrorCode(e);
      console.error("Comments list error:", e);
      if (code === "42P01") {
        res.status(503).json({
          message:
            "Комментарии не настроены на сервере. Администратору: node scripts/migrate-post-comments.cjs",
        });
        return;
      }
      res.status(500).json({ message: "Ошибка загрузки комментариев" });
    }
  });
}
