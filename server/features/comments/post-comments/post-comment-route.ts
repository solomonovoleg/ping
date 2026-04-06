import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../../../auth/session";
import { getDb } from "../../../db";
import { postComments, posts, users } from "@shared/schema";
import { notifyMentionsComment } from "../../../notifications/mentions";
import { notifyComment, notifyCommentReply } from "../../../notifications/create";
import { assertPostReadableByViewer, PostsServiceError } from "../../../posts/service";
import { storage } from "../../../storage";
import { resolveParentForReply } from "../comment-replies/resolve-parent-for-reply";
import { MAX_COMMENT_TEXT_LENGTH } from "../shared/constants";
import { pgErrorCode, pgErrorMessage } from "../shared/pg-errors";

export function registerPostCommentRoute(app: Express): void {
  app.post("/api/posts/:postId/comments", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = req.params.postId;
    const { text, parentCommentId: parentCommentIdRaw } = req.body ?? {};
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ message: "text required" });
      return;
    }
    if (text.length > MAX_COMMENT_TEXT_LENGTH) {
      res.status(400).json({
        message: `Комментарий слишком длинный (максимум ${MAX_COMMENT_TEXT_LENGTH} символов)`,
      });
      return;
    }
    try {
      await assertPostReadableByViewer(String(postId), userId);

      const db = getDb();
      const [postRow] = await db
        .select({ authorId: posts.authorId })
        .from(posts)
        .where(eq(posts.id, String(postId)))
        .limit(1);
      if (postRow && postRow.authorId !== userId) {
        const bf = await storage.getBlockFlags(postRow.authorId, userId);
        if (bf?.restrictSocial) {
          res.status(403).json({ message: "Пользователь отключил для вас комментарии и реакции" });
          return;
        }
      }

      let parentCommentAuthorId: string | null = null;
      let parentAuthorNameForResponse: string | null = null;
      let parentTextForResponse: string | null = null;
      let resolvedParentId: string | undefined;
      if (parentCommentIdRaw != null && parentCommentIdRaw !== "") {
        const resolved = await resolveParentForReply(db, String(postId), parentCommentIdRaw, userId);
        if (!resolved.ok) {
          res.status(resolved.status).json({ message: resolved.message });
          return;
        }
        parentCommentAuthorId = resolved.parentCommentAuthorId;
        parentAuthorNameForResponse = resolved.parentAuthorNameForResponse;
        parentTextForResponse = resolved.parentTextForResponse;
        resolvedParentId = resolved.resolvedParentId;
      }

      const insertValues: {
        postId: string;
        userId: string;
        text: string;
        parentCommentId?: string;
      } = {
        postId: String(postId),
        userId,
        text: text.trim(),
      };
      if (resolvedParentId) insertValues.parentCommentId = resolvedParentId;
      const returning = await db.insert(postComments).values(insertValues).returning();
      const inserted = Array.isArray(returning) ? returning[0] : undefined;

      if (!inserted) {
        res.status(500).json({ message: "Failed to create comment" });
        return;
      }

      notifyMentionsComment(inserted.id, String(postId), userId, inserted.text, storage).catch((e) =>
        console.error("[comments] notify mentions:", e),
      );
      notifyComment(String(postId), inserted.id, userId, inserted.text, {
        parentCommentAuthorId,
      }).catch((e) => console.error("[comments] notify comment:", e));
      if (parentCommentAuthorId) {
        notifyCommentReply(String(postId), inserted.id, userId, parentCommentAuthorId, inserted.text).catch((e) =>
          console.error("[comments] notify comment_reply:", e),
        );
      }

      const [userRow] = await db
        .select({
          displayName: users.displayName,
          surname: users.surname,
          avatarUrl: users.avatarUrl,
          publicId: users.publicId,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const displayName = userRow
        ? [userRow.displayName, userRow.surname].filter(Boolean).join(" ") || "Пользователь"
        : "Пользователь";

      res.status(201).json({
        id: inserted.id,
        postId: inserted.postId,
        userId: inserted.userId,
        publicId: userRow?.publicId ?? null,
        text: inserted.text,
        createdAt: inserted.createdAt?.toISOString?.() ?? inserted.createdAt,
        user: displayName,
        avatar: userRow?.avatarUrl ?? null,
        parentCommentId: inserted.parentCommentId ?? null,
        parentAuthorName: parentAuthorNameForResponse,
        parentText: parentTextForResponse,
        likes: 0,
        likedByMe: false,
      });
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      const code = pgErrorCode(e);
      const msg = pgErrorMessage(e);
      console.error("Create comment error:", e);
      if (code === "42P01") {
        res.status(503).json({
          message:
            "Таблица комментариев отсутствует в БД. Запустите: node scripts/migrate-post-comments.cjs (или полный деплой с миграциями).",
        });
        return;
      }
      if (code === "23503") {
        res.status(404).json({ message: "Пост не найден или недоступен" });
        return;
      }
      if (code === "23514") {
        res.status(400).json({
          message: "Комментарий не прошёл проверку (слишком длинный или недопустимое содержимое)",
        });
        return;
      }
      res.status(500).json({
        message:
          process.env.NODE_ENV === "development"
            ? msg
            : "Не удалось сохранить комментарий. Если ошибка повторяется, напишите в поддержку.",
      });
    }
  });
}
