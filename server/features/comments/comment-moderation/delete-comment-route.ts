import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../../../auth/session";
import { getDb } from "../../../db";
import { postComments, posts } from "@shared/schema";
import { assertPostReadableByViewer, PostsServiceError } from "../../../posts/service";

export function registerDeleteCommentRoute(app: Express): void {
  app.delete(
    "/api/posts/:postId/comments/:commentId",
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const postId = String(req.params.postId ?? "");
      const commentId = String(req.params.commentId ?? "");
      if (!postId || !commentId) {
        res.status(400).json({ message: "postId и commentId обязательны" });
        return;
      }
      try {
        await assertPostReadableByViewer(postId, userId);
        const db = getDb();
        const [postRow] = await db
          .select({ authorId: posts.authorId })
          .from(posts)
          .where(eq(posts.id, postId))
          .limit(1);
        if (!postRow) {
          res.status(404).json({ message: "Пост не найден" });
          return;
        }
        const [commentRow] = await db
          .select({ id: postComments.id, userId: postComments.userId })
          .from(postComments)
          .where(and(eq(postComments.id, commentId), eq(postComments.postId, postId)))
          .limit(1);
        if (!commentRow) {
          res.status(404).json({ message: "Комментарий не найден" });
          return;
        }
        const isCommentAuthor = commentRow.userId === userId;
        const isPostAuthor = postRow.authorId === userId;
        if (!isCommentAuthor && !isPostAuthor) {
          res.status(403).json({ message: "Нет права удалить комментарий" });
          return;
        }
        await db.delete(postComments).where(eq(postComments.id, commentId));
        res.status(204).end();
      } catch (e) {
        if (e instanceof PostsServiceError) {
          res.status(e.status).json({ message: e.message });
          return;
        }
        console.error("Delete comment error:", e);
        res.status(500).json({ message: "Не удалось удалить комментарий" });
      }
    },
  );
}
