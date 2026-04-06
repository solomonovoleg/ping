import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { createPost, parsePostEdgeId, PostsServiceError } from "./service";
import { isPostMediaLayout, type PostMediaLayout } from "@shared/post-media-layout";
import { parsePushTtl } from "../push-feed/service";

export function registerPostsCreateRoutes(app: Express): void {
  app.post("/api/posts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() || null : null;
    const mediaUrlsRaw = req.body?.mediaUrls;
    const mediaUrls = Array.isArray(mediaUrlsRaw)
      ? (mediaUrlsRaw as unknown[])
          .filter((u): u is string => typeof u === "string" && u.trim() !== "")
          .map((u) => u.trim())
          .slice(0, 10)
      : null;
    const mediaLayoutRaw = req.body?.mediaLayout;
    const mediaLayout: PostMediaLayout | null = isPostMediaLayout(mediaLayoutRaw) ? mediaLayoutRaw : null;
    const firstUrl = mediaUrls?.length ? mediaUrls[0] : imageUrl;
    const isDraft = req.body?.isDraft === true;
    const visibility =
      typeof req.body?.visibility === "string" && (req.body.visibility === "public" || req.body.visibility === "followers")
        ? req.body.visibility
        : "public";
    let edgeIdForPost: string | undefined;
    if (req.body?.edgeId !== undefined && req.body?.edgeId !== null) {
      const s = String(req.body.edgeId).trim();
      if (s) {
        const parsed = parsePostEdgeId(req.body.edgeId);
        if (!parsed) {
          res.status(400).json({ message: "Некорректный edgeId" });
          return;
        }
        edgeIdForPost = parsed;
      }
    }
    const linkEmbedEnabled = req.body?.linkEmbedEnabled !== false;
    const sendToPush = req.body?.sendToPush === true;
    const pushTtl = parsePushTtl(req.body?.pushTtl);
    const hasMedia = Boolean((mediaUrls && mediaUrls.length > 0) || imageUrl);
    if (!text && !hasMedia && !edgeIdForPost) {
      res.status(400).json({ message: "Добавьте текст, медиа или пост с кампанией EDGE" });
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
        ...(edgeIdForPost ? { edgeId: edgeIdForPost } : {}),
        linkEmbedEnabled,
        sendToPush,
        pushTtl,
        ...(req.body?.showOnAuthorWall === false ? { showOnAuthorWall: false as const } : {}),
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
      if (e instanceof PostsServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      let message = e instanceof Error ? e.message : "Ошибка публикации";
      if (message.includes("relation") && message.includes("does not exist")) {
        message = "Сервис постов недоступен. Выполните миграцию: node scripts/migrate-posts.cjs";
      }
      res.status(message.includes("недоступен") ? 503 : 500).json({ message });
    }
  });
}
