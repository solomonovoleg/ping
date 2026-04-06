import type { Express, Request, Response } from "express";
import { and, count, eq } from "drizzle-orm";
import { postCommentLikes, postComments, posts } from "@shared/schema";
import { requireAuth, getUserId } from "../../../auth/session";
import { getDb } from "../../../db";
import { assertPostReadableByViewer, PostsServiceError } from "../../../posts/service";
import { storage } from "../../../storage";
import { pgErrorCode } from "../shared/pg-errors";

export function registerPostCommentLikeRoute(app: Express): void {
  app.post(
    "/api/posts/:postId/comments/:commentId/like",
    requireAuth,
    async (req: Request, res: Response) => {
      const postId = String(req.params.postId ?? "");
      const commentId = String(req.params.commentId ?? "");
      const userId = getUserId(req)!;
      if (!postId || !commentId) {
        res.status(400).json({ message: "postId и commentId обязательны" });
        return;
      }
      try {
        await assertPostReadableByViewer(postId, userId);
        const db = getDb();

        const [commentRow] = await db
          .select({ id: postComments.id, postId: postComments.postId })
          .from(postComments)
          .where(eq(postComments.id, commentId))
          .limit(1);
        if (!commentRow || commentRow.postId !== postId) {
          res.status(404).json({ message: "Комментарий не найден" });
          return;
        }

        const [postRow] = await db
          .select({ authorId: posts.authorId })
          .from(posts)
          .where(eq(posts.id, postId))
          .limit(1);
        if (postRow && postRow.authorId !== userId) {
          const bf = await storage.getBlockFlags(postRow.authorId, userId);
          if (bf?.restrictSocial) {
            res.status(403).json({ message: "Пользователь отключил для вас комментарии и реакции" });
            return;
          }
        }

        const [existing] = await db
          .select({ commentId: postCommentLikes.commentId })
          .from(postCommentLikes)
          .where(and(eq(postCommentLikes.commentId, commentId), eq(postCommentLikes.userId, userId)))
          .limit(1);

        let liked: boolean;
        if (existing) {
          await db
            .delete(postCommentLikes)
            .where(and(eq(postCommentLikes.commentId, commentId), eq(postCommentLikes.userId, userId)));
          liked = false;
        } else {
          await db.insert(postCommentLikes).values({ commentId, userId });
          liked = true;
        }

        const [agg] = await db
          .select({ n: count() })
          .from(postCommentLikes)
          .where(eq(postCommentLikes.commentId, commentId));
        const likes = Number(agg?.n ?? 0);
        res.json({ liked, likes });
      } catch (e) {
        if (e instanceof PostsServiceError) {
          res.status(e.status).json({ message: e.message });
          return;
        }
        const code = pgErrorCode(e);
        console.error("[comments] toggle like:", e);
        if (code === "42P01") {
          res.status(503).json({
            message:
              "Лайки комментариев не настроены. Запустите: node scripts/migrate-post-comment-likes.cjs",
          });
          return;
        }
        res.status(500).json({ message: "Не удалось обновить лайк" });
      }
    },
  );
}
