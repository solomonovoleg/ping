import type { Express, Request, Response } from "express";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stories, users, storyViews } from "@shared/schema";
import { requireAuth, getUserId } from "../auth/session";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export type StoryRow = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

/** Сториз по authorId (для объединённого эндпоинта страницы профиля). */
export async function getStoriesByAuthorId(authorId: string): Promise<StoryRow[]> {
  const db = getDb();
  const since = new Date(Date.now() - STORY_TTL_MS);
  const rows = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      createdAt: stories.createdAt,
    })
    .from(stories)
    .where(and(eq(stories.authorId, authorId), gt(stories.createdAt, since)))
    .orderBy(desc(stories.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
  }));
}

export function registerStoriesRoutes(app: Express): void {
  /** Сториз пользователя по id или publicId (публичный эндпоинт для просмотра профиля) */
  app.get("/api/users/:userId/stories", async (req: Request, res: Response) => {
    const userIdParam = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!userIdParam) {
      res.status(400).json({ message: "userId required" });
      return;
    }
    try {
      const db = getDb();
      let authorId: string | null = null;
      const uid = String(userIdParam);
      if (/^\d+$/.test(uid)) {
        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.publicId, parseInt(uid, 10))).limit(1);
        authorId = u?.id ?? null;
      } else {
        authorId = uid;
      }
      if (!authorId) {
        res.json([]);
        return;
      }
      const since = new Date(Date.now() - STORY_TTL_MS);
      const rows = await db
        .select({
          id: stories.id,
          authorId: stories.authorId,
          mediaUrl: stories.mediaUrl,
          thumbnailUrl: stories.thumbnailUrl,
          createdAt: stories.createdAt,
        })
        .from(stories)
        .where(and(eq(stories.authorId, authorId), gt(stories.createdAt, since)))
        .orderBy(desc(stories.createdAt))
        .limit(50);
      res.json(
        rows.map((r) => ({
          id: r.id,
          authorId: r.authorId,
          mediaUrl: r.mediaUrl,
          thumbnailUrl: r.thumbnailUrl ?? null,
          createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
        }))
      );
    } catch (e) {
      console.error("Stories list error:", e);
      res.status(500).json({ message: "Ошибка загрузки сториз" });
    }
  });

  /** Создать сториз (только авторизованный пользователь) */
  app.post("/api/stories", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { mediaUrl, thumbnailUrl } = req.body ?? {};
    const media = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
    if (!media) {
      res.status(400).json({ message: "Укажите mediaUrl" });
      return;
    }
    try {
      const db = getDb();
      const [inserted] = await db
        .insert(stories)
        .values({
          authorId: userId,
          mediaUrl: media,
          thumbnailUrl: typeof thumbnailUrl === "string" ? thumbnailUrl.trim() || null : null,
        })
        .returning();
      if (!inserted) {
        res.status(500).json({ message: "Не удалось создать сториз" });
        return;
      }
      res.status(201).json({
        id: inserted.id,
        authorId: inserted.authorId,
        mediaUrl: inserted.mediaUrl,
        thumbnailUrl: inserted.thumbnailUrl ?? null,
        createdAt: inserted.createdAt?.toISOString?.() ?? inserted.createdAt,
      });
    } catch (e) {
      console.error("Create story error:", e);
      res.status(500).json({ message: "Не удалось создать сториз" });
    }
  });

  /** Записать просмотр сториз (идемпотентно) */
  app.post("/api/stories/:id/view", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const storyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!storyId) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const db = getDb();
      const [story] = await db.select({ authorId: stories.authorId }).from(stories).where(eq(stories.id, storyId)).limit(1);
      if (!story) {
        res.status(404).json({ message: "Сториз не найден" });
        return;
      }
      await db
        .insert(storyViews)
        .values({ storyId, userId: viewerId })
        .onConflictDoNothing();
      res.json({ ok: true });
    } catch (e) {
      console.error("Story view error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });

  /** Лента сторис: авторы, на которых подписан текущий пользователь, с хотя бы одним сториз за последние 24ч */
  app.get("/api/stories/feed", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    try {
      const { storage } = await import("../storage");
      const followingIds = await storage.listFollowingIds(viewerId);
      const authorIds = [viewerId, ...followingIds];
      if (authorIds.length === 0) {
        res.json([]);
        return;
      }
      const db = getDb();
      const since = new Date(Date.now() - STORY_TTL_MS);
      const rows = await db
        .select({
          id: stories.id,
          authorId: stories.authorId,
          mediaUrl: stories.mediaUrl,
          thumbnailUrl: stories.thumbnailUrl,
          createdAt: stories.createdAt,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
          authorPublicId: users.publicId,
        })
        .from(stories)
        .innerJoin(users, eq(stories.authorId, users.id))
        .where(and(gt(stories.createdAt, since), inArray(stories.authorId, authorIds)))
        .orderBy(desc(stories.createdAt));
      const byAuthor = new Map<string, { author: { id: string; publicId: number; displayName: string | null; avatarUrl: string | null }; stories: typeof rows }>();
      for (const r of rows) {
        const id = r.authorId;
        if (!byAuthor.has(id)) {
          byAuthor.set(id, {
            author: {
              id,
              publicId: r.authorPublicId,
              displayName: r.authorDisplayName ?? null,
              avatarUrl: r.authorAvatarUrl ?? null,
            },
            stories: [],
          });
        }
        byAuthor.get(id)!.stories.push(r);
      }
      const list = Array.from(byAuthor.entries())
        .sort((a, b) => {
          const aLatest = a[1].stories[0]?.createdAt?.getTime() ?? 0;
          const bLatest = b[1].stories[0]?.createdAt?.getTime() ?? 0;
          return bLatest - aLatest;
        })
        .map(([authorId, data]) => ({
          authorId,
          author: data.author,
          stories: data.stories.map((s) => ({
            id: s.id,
            authorId: s.authorId,
            mediaUrl: s.mediaUrl,
            thumbnailUrl: s.thumbnailUrl ?? null,
            createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
          })),
        }));
      res.json(list);
    } catch (e) {
      console.error("Stories feed error:", e);
      res.status(500).json({ message: "Ошибка загрузки ленты сторис" });
    }
  });

  /** Удалить свой сториз */
  app.delete("/api/stories/:id", requireAuth, async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = getUserId(req)!;
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const db = getDb();
      const deleted = await db
        .delete(stories)
        .where(and(eq(stories.id, id), eq(stories.authorId, userId)))
        .returning({ id: stories.id });
      if (!deleted.length) {
        res.status(404).json({ message: "Сториз не найден или нет прав" });
        return;
      }
      res.status(204).end();
    } catch (e) {
      console.error("Delete story error:", e);
      res.status(500).json({ message: "Не удалось удалить сториз" });
    }
  });
}
