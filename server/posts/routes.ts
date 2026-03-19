import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import {
  createPost,
  deleteOwnPost,
  getPostByIdDetailed,
  listPostsForViewer,
  listSavedPostsDetailed,
  PostsServiceError,
  recordPostView,
  savePost,
  sharePostToUser,
  unsavePost,
  updateOwnPost,
} from "./service";
import { isPostMediaLayout, type PostMediaLayout } from "@shared/post-media-layout";

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
    const mediaLayoutRaw = req.body?.mediaLayout;
    const mediaLayout: PostMediaLayout | null = isPostMediaLayout(mediaLayoutRaw) ? mediaLayoutRaw : null;
    const firstUrl = mediaUrls?.length ? mediaUrls[0] : imageUrl;
    const isDraft = req.body?.isDraft === true;
    const visibility = typeof req.body?.visibility === "string" && (req.body.visibility === "public" || req.body.visibility === "followers")
      ? req.body.visibility
      : "public";
    const hasMedia = Boolean((mediaUrls && mediaUrls.length > 0) || imageUrl);
    if (!text && !hasMedia) {
      res.status(400).json({ message: "Добавьте текст или медиа в пост" });
      return;
    }
    try {
      const payload = await createPost({
        userId,
        text,
        imageUrl: firstUrl ?? null,
        mediaUrls: mediaUrls ?? (imageUrl ? [imageUrl] : null),
        mediaLayout,
        isDraft: !!isDraft,
        visibility,
      });
      console.log("[posts] created", {
        id: payload.id,
        authorId: payload.authorId,
        textLength: payload.text?.length,
        mediaCount: payload.mediaUrls.length,
      });
      res.status(201).json(payload);
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
      const list = await listPostsForViewer({
        authorId,
        hashtagParam,
        qParam,
        limit,
        offset,
        viewerId,
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
      const payload = await getPostByIdDetailed(postId, viewerId ?? null);
      res.json(payload);
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
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
      await recordPostView(postId, userId);
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
      await deleteOwnPost(postId, userId);
      res.status(204).end();
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
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
    const mediaLayoutRaw = req.body?.mediaLayout;
    const mediaLayout = mediaLayoutRaw === null ? null : isPostMediaLayout(mediaLayoutRaw) ? mediaLayoutRaw : undefined;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const isDraft = req.body?.isDraft;
      const visibility = req.body?.visibility;
      const payload = await updateOwnPost({
        postId,
        userId,
        text,
        imageUrl,
        mediaUrls,
        mediaLayout,
        isDraft: typeof isDraft === "boolean" ? isDraft : undefined,
        visibility: visibility === "public" || visibility === "followers" ? visibility : undefined,
      });
      res.json(payload);
    } catch (e) {
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
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

  /** Сохранить пост в закладки */
  app.post("/api/posts/:postId/save", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
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

  /** Убрать пост из закладок */
  app.delete("/api/posts/:postId/save", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
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

  /** Список сохранённых постов (полные посты как в ленте) */
  app.get("/api/me/saved-posts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    try {
      const list = await listSavedPostsDetailed(userId, limit, offset);
      res.json(list);
    } catch (e) {
      console.error("Saved posts list error:", e);
      res.status(500).json({ message: "Ошибка загрузки сохранённого" });
    }
  });
}
