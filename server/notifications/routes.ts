import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { getDb, ensureStoryCaptionNotificationSchema } from "../db";
import { notifications, posts, users } from "@shared/schema";
import { requireAuth, getUserId } from "../auth/session";
import { storage } from "../storage";

export function registerNotificationsRoutes(app: Express): void {
  /** Список уведомлений текущего пользователя */
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    try {
      await ensureStoryCaptionNotificationSchema();
      const db = getDb();
      const rows = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          actorId: notifications.actorId,
          actorPublicId: users.publicId,
          postId: notifications.postId,
          commentId: notifications.commentId,
          storyId: notifications.storyId,
          excerpt: notifications.excerpt,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
          actorDisplayName: users.displayName,
          actorSurname: users.surname,
          actorAvatarUrl: users.avatarUrl,
          postAuthorId: posts.authorId,
          postLinkCode: posts.linkCode,
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.actorId, users.id))
        .leftJoin(posts, eq(notifications.postId, posts.id))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
      const postAuthorIds = Array.from(
        new Set(rows.map((r) => r.postAuthorId).filter((id): id is string => typeof id === "string" && id.length > 0))
      );
      const postAuthorPublicIdById = new Map<string, number>();
      await Promise.all(
        postAuthorIds.map(async (authorId) => {
          const author = await storage.getUser(authorId);
          if (author?.publicId != null) postAuthorPublicIdById.set(authorId, author.publicId);
        })
      );
      const list = rows.map((r) => ({
        id: r.id,
        type: r.type,
        actorId: r.actorId,
        actorPublicId: r.actorPublicId ?? null,
        actorName: [r.actorDisplayName, r.actorSurname].filter(Boolean).join(" ") || "Пользователь",
        actorAvatarUrl: r.actorAvatarUrl ?? null,
        postId: r.postId ?? null,
        postAuthorId: r.postAuthorId ?? null,
        postLinkCode: r.postLinkCode ?? null,
        postAuthorPublicId: r.postAuthorId ? (postAuthorPublicIdById.get(r.postAuthorId) ?? null) : null,
        commentId: r.commentId ?? null,
        storyId: r.storyId ?? null,
        excerpt: r.excerpt ?? null,
        readAt: r.readAt?.toISOString?.() ?? null,
        createdAt: r.createdAt?.toISOString?.() ?? null,
      }));
      res.json(list);
    } catch (e) {
      console.error("Notifications list error:", e);
      res.status(500).json({ message: "Ошибка загрузки уведомлений" });
    }
  });

  /** Отметить уведомление прочитанным */
  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const db = getDb();
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
      res.json({ ok: true });
    } catch (e) {
      console.error("Notification read error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });

  /** Отметить все уведомления прочитанными */
  app.post("/api/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const db = getDb();
      await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId));
      res.json({ ok: true });
    } catch (e) {
      console.error("Notifications read-all error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });
}
