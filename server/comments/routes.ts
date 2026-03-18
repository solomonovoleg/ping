import type { Express, Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../auth/session";
import { getDb } from "../db";
import { postComments } from "@shared/schema";
import { users } from "@shared/schema";
import { notifyMentionsComment } from "../notifications/mentions";
import { notifyComment } from "../notifications/create";

export function registerCommentsRoutes(app: Express): void {
  /** Список комментариев к посту (доступно без авторизации для просмотра) */
  app.get("/api/posts/:postId/comments", async (req: Request, res: Response) => {
    const postId = req.params.postId;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
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
    } catch {
      res.json([]);
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
    try {
      const db = getDb();
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

      const { storage } = await import("../storage");
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
      console.error("Create comment error:", e);
      res.status(503).json({ message: "Сервис комментариев недоступен" });
    }
  });
}
