import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { deleteOwnPost, updateOwnPost, PostsServiceError } from "./service";
import { isPostMediaLayout, type PostMediaLayout } from "@shared/post-media-layout";
import { postsRoutePostId } from "./posts-route-helpers";

export function registerPostsMutateRoutes(app: Express): void {
  app.delete("/api/posts/:postId", requireAuth, async (req: Request, res: Response) => {
    const postId = postsRoutePostId(req);
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

  app.patch("/api/posts/:postId", requireAuth, async (req: Request, res: Response) => {
    const postId = postsRoutePostId(req);
    const userId = getUserId(req)!;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : undefined;
    const imageUrl =
      req.body?.imageUrl !== undefined
        ? typeof req.body.imageUrl === "string"
          ? req.body.imageUrl.trim() || null
          : null
        : undefined;
    const body = req.body as Record<string, unknown> | undefined;
    const hasMediaUrlsKey = body != null && Object.prototype.hasOwnProperty.call(body, "mediaUrls");
    const mediaUrlsRaw = hasMediaUrlsKey ? body.mediaUrls : undefined;
    const mediaUrls =
      !hasMediaUrlsKey
        ? undefined
        : Array.isArray(mediaUrlsRaw)
          ? (mediaUrlsRaw as unknown[])
              .filter((u): u is string => typeof u === "string" && u.trim() !== "")
              .map((u) => u.trim())
              .slice(0, 10)
          : [];
    const mediaLayoutRaw = req.body?.mediaLayout;
    const mediaLayout: PostMediaLayout | null | undefined =
      mediaLayoutRaw === null ? null : isPostMediaLayout(mediaLayoutRaw) ? mediaLayoutRaw : undefined;
    if (!postId) {
      res.status(400).json({ message: "postId required" });
      return;
    }
    try {
      const isDraft = req.body?.isDraft;
      const visibility = req.body?.visibility;
      const edgeAud = req.body?.edgeDisplayAudience;
      const edgeDisplayAudience =
        edgeAud === "self" || edgeAud === "followers" || edgeAud === "public" ? edgeAud : undefined;
      const leRaw = body?.linkEmbedEnabled;
      const linkEmbedEnabled = typeof leRaw === "boolean" ? leRaw : undefined;
      const payload = await updateOwnPost({
        postId,
        userId,
        text,
        imageUrl,
        mediaUrls,
        mediaLayout,
        isDraft: typeof isDraft === "boolean" ? isDraft : undefined,
        visibility: visibility === "public" || visibility === "followers" ? visibility : undefined,
        edgeDisplayAudience,
        linkEmbedEnabled,
      });
      if (hasMediaUrlsKey) {
        console.info("[posts] patch media", {
          postId,
          userId,
          mediaCount: payload.mediaUrls?.length ?? 0,
          firstUrl: payload.mediaUrls?.[0]?.slice(0, 120) ?? null,
        });
      }
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
}
