import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../auth/session";
import { getDb } from "../db";
import { postComments, posts, users } from "@shared/schema";
import { notifyMentionsComment } from "../notifications/mentions";
import { notifyComment } from "../notifications/create";
import { assertPostReadableByViewer, PostsServiceError } from "../posts/service";
import { storage } from "../storage";

const MAX_COMMENT_TEXT_LENGTH = 8000;

function pgErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) return String((err as { code?: string }).code);
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (cause && typeof cause === "object" && cause !== null && "code" in cause) {
    return String((cause as { code?: string }).code);
  }
  return "";
}

function pgErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (cause instanceof Error) return cause.message;
  return String(err);
}

export function registerCommentsRoutes(app: Express): void {
  /** Список комментариев — только если пост доступен зрителю (видимость / подписка / черновик). */
  app.get("/api/posts/:postId/comments", async (req: Request, res: Response) => {
    const postId = req.params.postId;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const viewerId = getUserId(req) ?? null;
      await assertPostReadableByViewer(String(postId), viewerId);
      const db = getDb();
      const rows = await db
        .select({
          id: postComments.id,
          postId: postComments.postId,
          userId: postComments.userId,
          text: postComments.text,
          createdAt: postComments.createdAt,
          displayName: users.displayName,
          surname: users.surname,
          avatarUrl: users.avatarUrl,
        })
        .from(postComments)
        .leftJoin(users, eq(postComments.userId, users.id))
        .where(eq(postComments.postId, String(postId)))
        .orderBy(desc(postComments.createdAt))
        .limit(500);

      const list = rows.map((r) => ({
        id: r.id,
        postId: r.postId,
        userId: r.userId,
        text: r.text,
        createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
        user: [r.displayName, r.surname].filter(Boolean).join(" ") || "Пользователь",
        avatar: r.avatarUrl ?? null,
        likes: 0,
      }));
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

  /** Добавить комментарий (только авторизованный пользователь) */
  app.post("/api/posts/:postId/comments", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = req.params.postId;
    const { text } = req.body ?? {};
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
      const [inserted] = await db
        .insert(postComments)
        .values({
          postId: String(postId),
          userId,
          text: text.trim(),
        })
        .returning();

      if (!inserted) {
        res.status(500).json({ message: "Failed to create comment" });
        return;
      }

      notifyMentionsComment(inserted.id, String(postId), userId, inserted.text, storage).catch((e) =>
        console.error("[comments] notify mentions:", e)
      );
      notifyComment(String(postId), inserted.id, userId, inserted.text).catch((e) =>
        console.error("[comments] notify comment:", e)
      );

      const [userRow] = await db
        .select({ displayName: users.displayName, surname: users.surname, avatarUrl: users.avatarUrl })
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
        text: inserted.text,
        createdAt: inserted.createdAt?.toISOString?.() ?? inserted.createdAt,
        user: displayName,
        avatar: userRow?.avatarUrl ?? null,
        likes: 0,
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
        res.status(400).json({ message: "Комментарий не прошёл проверку (слишком длинный или недопустимое содержимое)" });
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

  /** Удалить комментарий: автор комментария или автор поста */
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
        const viewerId = userId;
        await assertPostReadableByViewer(postId, viewerId);
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
