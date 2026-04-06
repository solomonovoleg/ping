import type { Express, Request, Response } from "express";
import { requireAuth } from "../../auth/session";
import { s3Configured } from "../s3";
import { validateStoryVideoUpload } from "../story-video-transcode";
import { detectPostMediaKind } from "./detect-post-media-kind";
import { getVideoTranscodeProfile, parsePostVideoTrim } from "./post-media-body-parse";
import { postMediaUpload } from "./create-post-media-multer";
import { mapPostMediaUploadErrorMessage } from "./map-post-media-upload-error";
import { processPostMediaDiskUpload } from "./process-post-media-disk";
import { processPostMediaS3Upload } from "./process-post-media-s3";

export function registerPostMediaUploadRoutes(app: Express): void {
  app.post(
    "/api/upload/post-media",
    requireAuth,
    postMediaUpload.single("file"),
    async (req: Request, res: Response) => {
      let mediaKind: ReturnType<typeof detectPostMediaKind> | undefined;
      let heicConversionAttempted = false;
      try {
        if (!req.file) {
          res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
          return;
        }
        mediaKind = detectPostMediaKind(req.file);
        const videoTrim =
          mediaKind === "video" ? parsePostVideoTrim(req.body as Record<string, unknown>) : undefined;
        const videoProfile = mediaKind === "video" ? getVideoTranscodeProfile(videoTrim) : "default";
        if (mediaKind === "video") {
          const videoErr = validateStoryVideoUpload(req.file);
          if (videoErr) {
            res.status(400).json({ message: videoErr });
            return;
          }
        }

        if (s3Configured) {
          if (!req.file.buffer) {
            console.error("[upload/post-media] S3 enabled but file.buffer missing (multer memory storage)");
            res.status(500).json({
              message:
                "Внутренняя ошибка загрузки: файл не попал в память. Перезапустите сервер или отключите S3 для локальной отдачи с диска.",
            });
            return;
          }
          const { url, posterUrl } = await processPostMediaS3Upload({
            file: req.file,
            mediaKind,
            videoTrim,
            videoProfile,
          });
          console.info("[upload/post-media] ok", { mediaKind, url: url.length > 200 ? `${url.slice(0, 200)}…` : url });
          res.status(201).json(posterUrl ? { url, posterUrl } : { url });
          return;
        }

        const disk = await processPostMediaDiskUpload({
          file: req.file as Express.Multer.File & { filename?: string; path?: string },
          mediaKind,
          videoTrim,
          videoProfile,
        });
        heicConversionAttempted = disk.heicConversionAttempted;
        console.info("[upload/post-media] ok", { mediaKind, url: disk.diskUrl });
        res.status(201).json(
          disk.posterUrl ? { url: disk.diskUrl, posterUrl: disk.posterUrl } : { url: disk.diskUrl },
        );
      } catch (err) {
        const storageMode = s3Configured ? "s3" : "disk";
        console.error("Post media upload error:", storageMode, err);
        const message = mapPostMediaUploadErrorMessage({
          err,
          mediaKind,
          heicConversionAttempted,
          hasFile: !!req.file,
          storageMode,
        });
        res.status(503).json({ message });
      }
    },
  );

  app.use((err: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
    if (err && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "Файл слишком большой (макс. 500 МБ)" });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ message: err.message || "Ошибка загрузки файла" });
      return;
    }
    next(err);
  });
}
