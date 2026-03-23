import type { Express, Request, Response, NextFunction } from "express";
import { createPost } from "../posts/service";
import { isPostMediaLayout, type PostMediaLayout } from "@shared/post-media-layout";

function requireParserServiceSecret(req: Request, res: Response, next: NextFunction): void {
  const s = process.env.PARSER_SERVICE_SECRET?.trim();
  if (!s) {
    res.status(503).json({ message: "PARSER_SERVICE_SECRET не задан на платформе" });
    return;
  }
  const auth = req.headers.authorization;
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== s) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/**
 * Loopback от микросервиса PARSER: создать пост от имени пользователя платформы.
 * Не префикс /api — не проходит через общий api-shield.
 */
export function registerInternalParserPublishRoutes(app: Express): void {
  app.post("/internal/parser/publish", requireParserServiceSecret, async (req: Request, res: Response) => {
    try {
      const platformUserId = String(req.body?.platformUserId ?? "").trim();
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const imageUrl =
        typeof req.body?.imageUrl === "string" && req.body.imageUrl.trim() ? req.body.imageUrl.trim() : null;
      const mediaUrlsRaw = req.body?.mediaUrls;
      const mediaUrls = Array.isArray(mediaUrlsRaw)
        ? (mediaUrlsRaw as unknown[])
            .filter((u): u is string => typeof u === "string" && u.trim() !== "")
            .map((u) => u.trim())
            .slice(0, 10)
        : null;
      const mediaLayoutRaw = req.body?.mediaLayout;
      const mediaLayout: PostMediaLayout | null = isPostMediaLayout(mediaLayoutRaw) ? mediaLayoutRaw : null;
      const visibility =
        req.body?.visibility === "followers" ? "followers" : ("public" as const);
      const firstUrl = mediaUrls?.length ? mediaUrls[0] : imageUrl;
      const hasMedia = Boolean((mediaUrls && mediaUrls.length > 0) || imageUrl);
      if (!text && !hasMedia) {
        res.status(400).json({ message: "Пустой пост" });
        return;
      }
      const payload = await createPost({
        userId: platformUserId,
        text: text || (hasMedia ? " " : ""),
        imageUrl: firstUrl ?? null,
        mediaUrls: mediaUrls ?? (imageUrl ? [imageUrl] : null),
        mediaLayout,
        isDraft: false,
        visibility,
      });
      res.json({ id: payload.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка публикации";
      res.status(400).json({ message: msg });
    }
  });
}
