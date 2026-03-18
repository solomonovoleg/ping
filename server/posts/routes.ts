import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, ilike, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { posts, users, postComments, postReactions, postViews, postShares, savedPosts, extractHashtags } from "@shared/schema";
import { notifyMentionsPost } from "../notifications/mentions";
import { requireAuth, getUserId } from "../auth/session";

export function registerPostsRoutes(app: Express): void {
  /** Создать пост (текст и опционально одно или несколько фото/видео). */
  app.post("/api/posts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() || null : null;
    const mediaUrlsRaw = req.body?.mediaUrls;
    const mediaUrls = Array.isArray(mediaUrlsRaw)
      ? (mediaUrlsRaw as unknown[]).filter((u): u is string => typeof u === "string" && u.trim() !== "").map((u) => u.trim()).slice(0, 10)
      : null;
    const firstUrl = mediaUrls?.length ? mediaUrls[0] : imageUrl;
    const isDraft = req.body?.isDraft === true;
    const visibility = typeof req.body?.visibility === "string" && (req.body.visibility === "public" || req.body.visibility === "followers")
      ? req.body.visibility
      : "public";
    if (!text) {
      res.status(400).json({ message: "Текст поста обязателен" });
      return;
    }
    try {
      const db = getDb();
      const hashtags = extractHashtags(text);
      const [row] = await db
        .insert(posts)
        .values({
          authorId: userId,
          text,
          imageUrl: firstUrl ?? null,
          mediaUrls: mediaUrls ?? (imageUrl ? [imageUrl] : null),
          hashtags: hashtags.length > 0 ? hashtags : null,
          isDraft: !!isDraft,
          visibility,
        })
        .returning();
      if (!row) {
        res.status(500).json({ message: "Не удалось создать пост" });
        return;
      }
      if (!isDraft) {
        const { storage } = await import("../storage");
        notifyMentionsPost(row.id, userId, text, storage).catch((e) => console.error("[posts] notify mentions:", e));
      }
      const urls = (row.mediaUrls as string[] | null)?.length ? (row.mediaUrls as string[]) : row.imageUrl ? [row.imageUrl] : [];
      console.log("[posts] created", { id: row.id, authorId: row.authorId, textLength: row.text?.length, mediaCount: urls.length });
      res.status(201).json({
        id: row.id,
        authorId: row.authorId,
        text: row.text,
        imageUrl: row.imageUrl ?? null,
        mediaUrls: urls,
        isDraft: row.isDraft ?? false,
        visibility: row.visibility ?? "public",
        createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
      });
    } catch (e) {
      console.error("Create post error:", e);
      let message = e instanceof Error ? e.message : "Ошибка публикации";
      if (message.includes("relation") && message.includes("does not exist")) {
        message = "Сервис постов недоступен. Выполните миграцию: node scripts/migrate-posts.cjs";
      }
      res.status(message.includes("недоступен") ? 503 : 500).json({ message });
    }
  });

  /** Лента: список постов. ?authorId= — стена. ?hashtag= — по хештегу. ?q= — поиск по тексту. Без authorId — лента подписок. */
  app.get("/api/posts", requireAuth, async (req: Request, res: Response) => {
    const authorId = typeof req.query.authorId === "string" ? req.query.authorId.trim() : undefined;
    const hashtagParam = typeof req.query.hashtag === "string" ? req.query.hashtag.trim().toLowerCase().replace(/^#/, "") : undefined;
    const qParam = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const viewerId = getUserId(req)!;
    try {
      const db = getDb();
      const selectFields = {
        id: posts.id,
        authorId: posts.authorId,
        text: posts.text,
        imageUrl: posts.imageUrl,
        mediaUrls: posts.mediaUrls,
        hashtags: posts.hashtags,
        isDraft: posts.isDraft,
        visibility: posts.visibility,
        createdAt: posts.createdAt,
        authorDisplayName: users.displayName,
        authorSurname: users.surname,
        authorAvatarUrl: users.avatarUrl,
        authorPublicId: users.publicId,
      };
      type Row = {
        id: string;
        authorId: string;
        text: string;
        imageUrl: string | null;
        mediaUrls: string[] | null;
        hashtags: string[] | null;
        isDraft: boolean;
        visibility: string;
        createdAt: Date;
        authorDisplayName: string | null;
        authorSurname: string | null;
        authorAvatarUrl: string | null;
        authorPublicId: number;
      };
      const hashtagCond = hashtagParam
        ? sql`${posts.hashtags} @> ${JSON.stringify([hashtagParam])}::jsonb`
        : undefined;
      const searchCond =
        qParam && qParam.length >= 2
          ? ilike(posts.text, `%${String(qParam).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`)
          : undefined;
      const draftCond = authorId === viewerId ? undefined : eq(posts.isDraft, false);
      let rows: Row[];
      if (authorId) {
        let whereClause: ReturnType<typeof and> | ReturnType<typeof eq> = draftCond ? and(eq(posts.authorId, authorId), draftCond) : eq(posts.authorId, authorId);
        if (hashtagCond) whereClause = and(whereClause, hashtagCond);
        if (searchCond) whereClause = and(whereClause, searchCond);
        rows = await db
          .select(selectFields)
          .from(posts)
          .innerJoin(users, eq(posts.authorId, users.id))
          .where(whereClause)
          .orderBy(desc(posts.createdAt))
          .limit(limit)
          .offset(offset);
        if (authorId !== viewerId && rows.length > 0) {
          const { storage } = await import("../storage");
          const isFollower = await storage.isFollowing(viewerId, authorId);
          if (!isFollower) {
            // Показываем посты с видимостью "public"; null/пусто считаем как public (обратная совместимость)
            rows = rows.filter((r) => (r.visibility ?? "public").toLowerCase() === "public");
          }
        }
      } else {
        const { storage } = await import("../storage");
        const followingIds = await storage.listFollowingIds(viewerId);
        const blockedIds = await storage.getBlockedRelationIds(viewerId);
        const blockedSet = new Set(blockedIds);
        const allowedAuthorIds = [viewerId, ...followingIds].filter((id) => !blockedSet.has(id));
        if (allowedAuthorIds.length === 0) {
          rows = [];
        } else {
          let baseWhere: ReturnType<typeof and> = and(inArray(posts.authorId, allowedAuthorIds), eq(posts.isDraft, false));
          if (hashtagCond) baseWhere = and(baseWhere, hashtagCond);
          if (searchCond) baseWhere = and(baseWhere, searchCond);
          const whereClause = baseWhere;
          rows = await db
            .select(selectFields)
            .from(posts)
            .innerJoin(users, eq(posts.authorId, users.id))
            .where(whereClause)
            .orderBy(desc(posts.createdAt))
            .limit(limit)
            .offset(offset);
        }
      }
      const postIds = rows.map((r: Row) => r.id);

      const counts: Record<string, number> = {};
      if (postIds.length > 0) {
        const countRows = await db
          .select({ postId: postComments.postId, count: sql<number>`count(*)::int` })
          .from(postComments)
          .where(inArray(postComments.postId, postIds))
          .groupBy(postComments.postId);
        countRows.forEach((r) => { counts[r.postId] = r.count; });
      }
      type LatestCommentRow = {
        id: string;
        postId: string;
        userId: string;
        text: string;
        createdAt: Date | string;
        displayName: string | null;
        surname: string | null;
        avatarUrl: string | null;
      };
      const latestCommentsByPost: Record<string, { id: string; postId: string; userId: string; text: string; createdAt: string; user: string; avatar: string | null; likes: number }[]> = {};
      if (postIds.length > 0) {
        const idList = sql.join(postIds.map((id) => sql`${id}`), sql`, `);
        const latestCommentRows = (await db.execute(sql`
          select c.id,
                 c.post_id as "postId",
                 c.user_id as "userId",
                 c.text,
                 c.created_at as "createdAt",
                 u.display_name as "displayName",
                 u.surname as "surname",
                 u.avatar_url as "avatarUrl"
          from (
            select pc.id,
                   pc.post_id,
                   pc.user_id,
                   pc.text,
                   pc.created_at,
                   row_number() over (partition by pc.post_id order by pc.created_at desc) as rn
            from post_comments pc
            where pc.post_id in (${idList})
          ) c
          left join users u on u.id = c.user_id
          where c.rn <= 2
          order by c.post_id asc, c.created_at desc
        `)) as unknown as LatestCommentRow[];
        latestCommentRows.forEach((r) => {
          if (!latestCommentsByPost[r.postId]) latestCommentsByPost[r.postId] = [];
          latestCommentsByPost[r.postId].push({
            id: r.id,
            postId: r.postId,
            userId: r.userId,
            text: r.text,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
            user: [r.displayName, r.surname].filter(Boolean).join(" ") || "Пользователь",
            avatar: r.avatarUrl ?? null,
            likes: 0,
          });
        });
      }

      const reactionsByPost: Record<string, { emoji: string; count: number }[]> = {};
      const reactionUsersByPost: Record<string, Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>> = {};
      const myReactions: Record<string, string> = {};
      if (postIds.length > 0) {
        const reactionRows = await db
          .select({
            postId: postReactions.postId,
            emoji: postReactions.emoji,
            count: sql<number>`count(*)::int`,
          })
          .from(postReactions)
          .where(inArray(postReactions.postId, postIds))
          .groupBy(postReactions.postId, postReactions.emoji);
        reactionRows.forEach((r) => {
          if (!reactionsByPost[r.postId]) reactionsByPost[r.postId] = [];
          reactionsByPost[r.postId].push({ emoji: r.emoji, count: r.count });
        });
        if (viewerId) {
          const myRows = await db
            .select({ postId: postReactions.postId, emoji: postReactions.emoji })
            .from(postReactions)
            .where(and(eq(postReactions.userId, viewerId), inArray(postReactions.postId, postIds)));
          myRows.forEach((r) => { myReactions[r.postId] = r.emoji; });
        }
        const whoReactedRows = await db
          .select({
            postId: postReactions.postId,
            emoji: postReactions.emoji,
            userId: users.id,
            displayName: users.displayName,
            surname: users.surname,
            avatarUrl: users.avatarUrl,
          })
          .from(postReactions)
          .innerJoin(users, eq(postReactions.userId, users.id))
          .where(inArray(postReactions.postId, postIds));
        whoReactedRows.forEach((r) => {
          if (!reactionUsersByPost[r.postId]) reactionUsersByPost[r.postId] = {};
          if (!reactionUsersByPost[r.postId][r.emoji]) reactionUsersByPost[r.postId][r.emoji] = [];
          reactionUsersByPost[r.postId][r.emoji].push({
            id: r.userId,
            displayName: r.displayName ?? null,
            surname: r.surname ?? null,
            avatarUrl: r.avatarUrl ?? null,
          });
        });
      }

      const viewCounts: Record<string, number> = {};
      if (postIds.length > 0) {
        const viewRows = await db
          .select({ postId: postViews.postId, count: sql<number>`count(*)::int` })
          .from(postViews)
          .where(inArray(postViews.postId, postIds))
          .groupBy(postViews.postId);
        viewRows.forEach((r) => { viewCounts[r.postId] = r.count; });
      }

      const list = rows.map((r: Row) => {
        const urls = (r.mediaUrls && Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0)
          ? r.mediaUrls
          : (r.imageUrl ? [r.imageUrl] : []);
        return {
        id: r.id,
        authorId: r.authorId,
        text: r.text,
        imageUrl: r.imageUrl ?? null,
        mediaUrls: urls,
        hashtags: (r.hashtags && Array.isArray(r.hashtags)) ? r.hashtags : [],
        reactions: reactionsByPost[r.id] ?? [],
        reactionUsers: reactionUsersByPost[r.id] ?? {},
        myReaction: viewerId ? (myReactions[r.id] ?? null) : null,
        viewsCount: viewCounts[r.id] ?? 0,
        createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
        author: {
          id: r.authorId,
          publicId: r.authorPublicId,
          displayName: r.authorDisplayName ?? null,
          surname: r.authorSurname ?? null,
          avatarUrl: r.authorAvatarUrl ?? null,
        },
        channelName: [r.authorDisplayName, r.authorSurname].filter(Boolean).join(" ") || `ID ${r.authorPublicId}`,
        commentsCount: counts[r.id] ?? 0,
        latestComments: latestCommentsByPost[r.id] ?? [],
      };
      });
      res.json(list);
    } catch (e) {
      console.error("Posts list error:", e);
      let message = e instanceof Error ? e.message : "Ошибка загрузки ленты";
      if (message.includes("relation") && message.includes("does not exist")) {
        message = "Сервис постов недоступен. Выполните миграцию: node scripts/migrate-posts.cjs";
      } else if (message.includes("DATABASE_URL")) {
        message = "База данных не настроена. Задайте DATABASE_URL в .env на сервере.";
      }
      res.status(message.includes("недоступен") || message.includes("не настроена") ? 503 : 500).json({ message });
    }
  });

  /** Один пост по ID (для прямой ссылки /profile/:userId/post/:postId) */
  app.get("/api/posts/:postId", async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const viewerId = getUserId(req);
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const db = getDb();
      const [row] = await db
        .select({
          id: posts.id,
          authorId: posts.authorId,
          text: posts.text,
          imageUrl: posts.imageUrl,
          mediaUrls: posts.mediaUrls,
          hashtags: posts.hashtags,
          createdAt: posts.createdAt,
          authorDisplayName: users.displayName,
          authorSurname: users.surname,
          authorAvatarUrl: users.avatarUrl,
          authorPublicId: users.publicId,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(eq(posts.id, postId))
        .limit(1);
      if (!row) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      const mediaUrls = (row.mediaUrls as string[] | null)?.length ? (row.mediaUrls as string[]) : row.imageUrl ? [row.imageUrl] : [];
      const postIds = [row.id];
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(postComments)
        .where(eq(postComments.postId, postId));
      const reactionRows = await db
        .select({ emoji: postReactions.emoji, count: sql<number>`count(*)::int` })
        .from(postReactions)
        .where(eq(postReactions.postId, postId))
        .groupBy(postReactions.emoji);
      const whoReactedRows = await db
        .select({
          emoji: postReactions.emoji,
          userId: users.id,
          displayName: users.displayName,
          surname: users.surname,
          avatarUrl: users.avatarUrl,
        })
        .from(postReactions)
        .innerJoin(users, eq(postReactions.userId, users.id))
        .where(eq(postReactions.postId, postId));
      const [viewRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(postViews)
        .where(eq(postViews.postId, postId));
      let myReaction: string | null = null;
      if (viewerId) {
        const [my] = await db
          .select({ emoji: postReactions.emoji })
          .from(postReactions)
          .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, viewerId)))
          .limit(1);
        myReaction = my?.emoji ?? null;
      }
      const reactionUsersByPost: Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> = {};
      whoReactedRows.forEach((r) => {
        if (!reactionUsersByPost[r.emoji]) reactionUsersByPost[r.emoji] = [];
        reactionUsersByPost[r.emoji].push({
          id: r.userId,
          displayName: r.displayName ?? null,
          surname: r.surname ?? null,
          avatarUrl: r.avatarUrl ?? null,
        });
      });
      res.json({
        id: row.id,
        authorId: row.authorId,
        text: row.text,
        imageUrl: row.imageUrl ?? null,
        mediaUrls,
        hashtags: (row.hashtags && Array.isArray(row.hashtags)) ? row.hashtags : [],
        reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count })),
        reactionUsers: reactionUsersByPost,
        myReaction,
        viewsCount: viewRow?.count ?? 0,
        createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
        author: {
          id: row.authorId,
          publicId: row.authorPublicId,
          displayName: row.authorDisplayName ?? null,
          surname: row.authorSurname ?? null,
          avatarUrl: row.authorAvatarUrl ?? null,
        },
        channelName: [row.authorDisplayName, row.authorSurname].filter(Boolean).join(" ") || `ID ${row.authorPublicId}`,
        commentsCount: countRow?.count ?? 0,
      });
    } catch (e) {
      console.error("Get post error:", e);
      res.status(500).json({ message: "Ошибка загрузки поста" });
    }
  });

  /** Записать просмотр поста (идемпотентно: один пользователь — один просмотр) */
  app.post("/api/posts/:postId/view", requireAuth, async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const userId = getUserId(req)!;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const db = getDb();
      await db
        .insert(postViews)
        .values({ postId, userId })
        .onConflictDoNothing();
      res.status(204).end();
    } catch (e) {
      console.error("Post view error:", e);
      res.status(500).json({ message: "Ошибка записи просмотра" });
    }
  });

  /** Удалить свой пост (полное удаление из БД) */
  app.delete("/api/posts/:postId", requireAuth, async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const userId = getUserId(req)!;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const db = getDb();
      const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      if (!existing) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      if (existing.authorId !== userId) {
        res.status(403).json({ message: "Можно удалить только свой пост" });
        return;
      }
      await db.delete(posts).where(eq(posts.id, postId));
      res.status(204).end();
    } catch (e) {
      console.error("Delete post error:", e);
      res.status(500).json({ message: "Ошибка удаления поста" });
    }
  });

  /** Редактировать свой пост */
  app.patch("/api/posts/:postId", requireAuth, async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const userId = getUserId(req)!;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : undefined;
    const imageUrl = req.body?.imageUrl !== undefined ? (typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() || null : null) : undefined;
    const mediaUrlsRaw = req.body?.mediaUrls;
    const mediaUrls = Array.isArray(mediaUrlsRaw)
      ? (mediaUrlsRaw as unknown[]).filter((u): u is string => typeof u === "string" && u.trim() !== "").map((u) => u.trim()).slice(0, 10)
      : undefined;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const db = getDb();
      const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      if (!existing) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      if (existing.authorId !== userId) {
        res.status(403).json({ message: "Можно редактировать только свой пост" });
        return;
      }
      const isDraft = req.body?.isDraft;
      const visibility = req.body?.visibility;
      const updates: { text?: string; imageUrl?: string | null; mediaUrls?: string[] | null; hashtags?: string[] | null; isDraft?: boolean; visibility?: string } = {};
      if (text !== undefined) {
        updates.text = text;
        updates.hashtags = extractHashtags(text).length > 0 ? extractHashtags(text) : null;
      }
      if (typeof isDraft === "boolean") updates.isDraft = isDraft;
      if (visibility === "public" || visibility === "followers") updates.visibility = visibility;
      if (mediaUrls !== undefined) {
        updates.mediaUrls = mediaUrls.length ? mediaUrls : null;
        updates.imageUrl = mediaUrls.length ? mediaUrls[0] : null;
      } else if (imageUrl !== undefined) {
        updates.imageUrl = imageUrl;
        if (imageUrl) updates.mediaUrls = [imageUrl];
        else updates.mediaUrls = null;
      }
      if (Object.keys(updates).length === 0) {
        const urls = (existing.mediaUrls as string[] | null)?.length ? (existing.mediaUrls as string[]) : existing.imageUrl ? [existing.imageUrl] : [];
        res.json({ id: existing.id, text: existing.text, imageUrl: existing.imageUrl ?? null, mediaUrls: urls, createdAt: existing.createdAt?.toISOString?.() });
        return;
      }
      const [row] = await db.update(posts).set(updates).where(eq(posts.id, postId)).returning();
      if (!row) {
        res.status(500).json({ message: "Не удалось обновить пост" });
        return;
      }
      const urls = (row.mediaUrls as string[] | null)?.length ? (row.mediaUrls as string[]) : row.imageUrl ? [row.imageUrl] : [];
      res.json({
        id: row.id,
        text: row.text,
        imageUrl: row.imageUrl ?? null,
        mediaUrls: urls,
        createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
      });
    } catch (e) {
      console.error("Update post error:", e);
      res.status(500).json({ message: "Ошибка обновления поста" });
    }
  });

  /** Отправить пост другому пользователю (создаёт запись и сообщение в чате с превью) */
  app.post("/api/posts/:postId/share", requireAuth, async (req: Request, res: Response) => {
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    const userId = getUserId(req)!;
    const toUserId = typeof req.body?.toUserId === "string" ? req.body.toUserId.trim() : "";
    if (!postId || !toUserId) {
      res.status(400).json({ message: "Укажите postId и toUserId" });
      return;
    }
    if (toUserId === userId) {
      res.status(400).json({ message: "Нельзя отправить пост себе" });
      return;
    }
    const { storage } = await import("../storage");
    try {
      const db = getDb();
      const [postRow] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      if (!postRow) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      const toUser = await storage.getUser(toUserId);
      if (!toUser || toUser.deletedAt || toUser.isBlocked) {
        res.status(404).json({ message: "Пользователь не найден" });
        return;
      }
      const chat = await storage.getOrCreateDmChat(userId, toUserId);
      const { notifyChatListUpdate } = await import("../calls/ws");
      notifyChatListUpdate(toUserId);
      const author = await storage.getUser(postRow.authorId);
      const authorName = author ? [author.displayName, author.surname].filter(Boolean).join(" ") || `ID ${author.publicId}` : "Пользователь";
      await db.insert(postShares).values({
        postId,
        fromUserId: userId,
        toUserId,
      });
      const previewContent = JSON.stringify({
        postId,
        text: postRow.text?.slice(0, 200) ?? "",
        imageUrl: postRow.imageUrl ?? null,
        authorName,
        authorId: postRow.authorId,
      });
      await storage.createMessage({
        chatId: chat.id,
        senderId: userId,
        type: "post_share",
        content: previewContent,
      });
      res.status(201).json({ chatId: chat.id });
    } catch (e) {
      console.error("Share post error:", e);
      res.status(500).json({ message: "Не удалось отправить пост" });
    }
  });

  /** Сохранить пост в закладки */
  app.post("/api/posts/:postId/save", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const db = getDb();
      const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
      if (!post) {
        res.status(404).json({ message: "Пост не найден" });
        return;
      }
      await db.insert(savedPosts).values({ userId, postId }).onConflictDoNothing();
      res.json({ ok: true });
    } catch (e) {
      console.error("Save post error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });

  /** Убрать пост из закладок */
  app.delete("/api/posts/:postId/save", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const db = getDb();
      await db.delete(savedPosts).where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
      res.json({ ok: true });
    } catch (e) {
      console.error("Unsave post error:", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });

  /** Список сохранённых постов (полные посты как в ленте) */
  app.get("/api/me/saved-posts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    try {
      const db = getDb();
      const saved = await db
        .select({ postId: savedPosts.postId, savedAt: savedPosts.savedAt })
        .from(savedPosts)
        .where(eq(savedPosts.userId, userId))
        .orderBy(desc(savedPosts.savedAt))
        .limit(limit)
        .offset(offset);
      const postIds = saved.map((s) => s.postId);
      if (postIds.length === 0) {
        res.json([]);
        return;
      }
      const rows = await db
        .select({
          id: posts.id,
          authorId: posts.authorId,
          text: posts.text,
          imageUrl: posts.imageUrl,
          mediaUrls: posts.mediaUrls,
          hashtags: posts.hashtags,
          createdAt: posts.createdAt,
          authorDisplayName: users.displayName,
          authorSurname: users.surname,
          authorAvatarUrl: users.avatarUrl,
          authorPublicId: users.publicId,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(inArray(posts.id, postIds));
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = postIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
      const postIdsForCounts = ordered.map((r) => r.id);
      const counts: Record<string, number> = {};
      const countRows = await db
        .select({ postId: postComments.postId, count: sql<number>`count(*)::int` })
        .from(postComments)
        .where(inArray(postComments.postId, postIdsForCounts))
        .groupBy(postComments.postId);
      countRows.forEach((r) => { counts[r.postId] = r.count; });
      type LatestCommentRow = {
        id: string;
        postId: string;
        userId: string;
        text: string;
        createdAt: Date | string;
        displayName: string | null;
        surname: string | null;
        avatarUrl: string | null;
      };
      const latestCommentsByPost: Record<string, { id: string; postId: string; userId: string; text: string; createdAt: string; user: string; avatar: string | null; likes: number }[]> = {};
      if (postIdsForCounts.length > 0) {
        const idList = sql.join(postIdsForCounts.map((id) => sql`${id}`), sql`, `);
        const latestCommentRows = (await db.execute(sql`
          select c.id,
                 c.post_id as "postId",
                 c.user_id as "userId",
                 c.text,
                 c.created_at as "createdAt",
                 u.display_name as "displayName",
                 u.surname as "surname",
                 u.avatar_url as "avatarUrl"
          from (
            select pc.id,
                   pc.post_id,
                   pc.user_id,
                   pc.text,
                   pc.created_at,
                   row_number() over (partition by pc.post_id order by pc.created_at desc) as rn
            from post_comments pc
            where pc.post_id in (${idList})
          ) c
          left join users u on u.id = c.user_id
          where c.rn <= 2
          order by c.post_id asc, c.created_at desc
        `)) as unknown as LatestCommentRow[];
        latestCommentRows.forEach((r) => {
          if (!latestCommentsByPost[r.postId]) latestCommentsByPost[r.postId] = [];
          latestCommentsByPost[r.postId].push({
            id: r.id,
            postId: r.postId,
            userId: r.userId,
            text: r.text,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
            user: [r.displayName, r.surname].filter(Boolean).join(" ") || "Пользователь",
            avatar: r.avatarUrl ?? null,
            likes: 0,
          });
        });
      }
      const reactionRows = await db
        .select({ postId: postReactions.postId, emoji: postReactions.emoji, count: sql<number>`count(*)::int` })
        .from(postReactions)
        .where(inArray(postReactions.postId, postIdsForCounts))
        .groupBy(postReactions.postId, postReactions.emoji);
      const reactionsByPost: Record<string, { emoji: string; count: number }[]> = {};
      reactionRows.forEach((r) => {
        if (!reactionsByPost[r.postId]) reactionsByPost[r.postId] = [];
        reactionsByPost[r.postId].push({ emoji: r.emoji, count: r.count });
      });
      const viewRows = await db
        .select({ postId: postViews.postId, count: sql<number>`count(*)::int` })
        .from(postViews)
        .where(inArray(postViews.postId, postIdsForCounts))
        .groupBy(postViews.postId);
      const viewCounts: Record<string, number> = {};
      viewRows.forEach((r) => { viewCounts[r.postId] = r.count; });
      const myReactionRows = await db
        .select({ postId: postReactions.postId, emoji: postReactions.emoji })
        .from(postReactions)
        .where(and(eq(postReactions.userId, userId), inArray(postReactions.postId, postIdsForCounts)));
      const myReactions: Record<string, string> = {};
      myReactionRows.forEach((r) => { myReactions[r.postId] = r.emoji; });
      const list = ordered.map((r) => {
        const urls = (r.mediaUrls && Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0) ? r.mediaUrls : (r.imageUrl ? [r.imageUrl] : []);
        return {
          id: r.id,
          authorId: r.authorId,
          text: r.text,
          imageUrl: r.imageUrl ?? null,
          mediaUrls: urls,
          hashtags: (r.hashtags && Array.isArray(r.hashtags)) ? r.hashtags : [],
          reactions: reactionsByPost[r.id] ?? [],
          reactionUsers: {},
          myReaction: myReactions[r.id] ?? null,
          viewsCount: viewCounts[r.id] ?? 0,
          createdAt: r.createdAt?.toISOString?.() ?? null,
          author: {
            id: r.authorId,
            publicId: r.authorPublicId,
            displayName: r.authorDisplayName ?? null,
            surname: r.authorSurname ?? null,
            avatarUrl: r.authorAvatarUrl ?? null,
          },
          channelName: [r.authorDisplayName, r.authorSurname].filter(Boolean).join(" ") || `ID ${r.authorPublicId}`,
          commentsCount: counts[r.id] ?? 0,
          latestComments: latestCommentsByPost[r.id] ?? [],
        };
      });
      res.json(list);
    } catch (e) {
      console.error("Saved posts list error:", e);
      res.status(500).json({ message: "Ошибка загрузки сохранённого" });
    }
  });
}
