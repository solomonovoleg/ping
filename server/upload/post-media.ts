import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3, uploadToS3WithKey } from "./s3";
import { AVATAR_VIDEO_MAX_SECONDS, POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import {
  transcodeStoryVideoBuffer,
  transcodeStoryVideoFileToPath,
  validateStoryVideoUpload,
  type VideoTranscodeProfile,
  type VideoTranscodeTrim,
} from "./story-video-transcode";

function parseTrimCapSec(body: Record<string, unknown> | undefined): number {
  if (!body) return POST_VIDEO_MAX_SECONDS;
  const raw = body.trimMaxSeconds;
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (n === AVATAR_VIDEO_MAX_SECONDS) return AVATAR_VIDEO_MAX_SECONDS;
  return POST_VIDEO_MAX_SECONDS;
}

function parsePostVideoTrim(body: Record<string, unknown> | undefined): VideoTranscodeTrim | undefined {
  if (!body) return undefined;
  const cap = parseTrimCapSec(body);
  const s = body.trimStartSec;
  const d = body.trimDurationSec;
  const hasS = s !== undefined && s !== null && String(s).trim() !== "";
  const hasD = d !== undefined && d !== null && String(d).trim() !== "";
  if (!hasS || !hasD) return undefined;
  const startSec = Math.max(0, Number.parseFloat(String(s)) || 0);
  let durationSec = Number.parseFloat(String(d));
  if (!Number.isFinite(durationSec)) durationSec = cap;
  durationSec = Math.min(cap, Math.max(0.1, durationSec));
  return { startSec, durationSec, maxSegmentSec: cap };
}

function getVideoTranscodeProfile(trim: VideoTranscodeTrim | undefined): VideoTranscodeProfile {
  return trim?.maxSegmentSec === AVATAR_VIDEO_MAX_SECONDS ? "avatar" : "default";
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "posts");
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB (видео MOV/MP4 до 500 МБ)
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/x-png", // часть окружений отдаёт x-png для PNG
  "image/gif",
  "image/webp",
  "image/heic", // фото с iPhone (HEIC)
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime", // mov (iPhone и др.)
  "video/x-m4v",
  "video/m4v",
  "video/3gpp",
  "video/3gp",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
];
const ALLOWED_EXT_RE =
  /\.(jpe?g|png|gif|webp|heic|heif|mp4|webm|mov|m4v|3gp|3gpp|mp3|m4a|aac|wav|ogg)$/i;

function detectPostMediaKind(file: Pick<Express.Multer.File, "mimetype" | "originalname">): "image" | "video" | "audio" | "unknown" {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext)) return "image";
  if (/\.(mp4|webm|mov|m4v|3gp|3gpp)$/i.test(ext)) return "video";
  if (/\.(mp3|m4a|aac|wav|ogg)$/i.test(ext)) return "audio";
  return "unknown";
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const diskStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureDir(UPLOADS_DIR);
    cb(null, UPLOADS_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: s3Configured ? memoryStorage : diskStorage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || "").toLowerCase().trim();
    const byMime = !!mime && ALLOWED_MIMES.includes(mime);
    const byExt = ALLOWED_EXT_RE.test(file.originalname || "");
    if (!byMime && !byExt) {
      cb(
        new Error(
          "Разрешены только фото, видео и аудио (JPEG/PNG/WEBP/HEIC, MP4/MOV/WebM/M4V/3GP, MP3/M4A/WAV/OGG) до 500 МБ",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

export function registerPostMediaUploadRoutes(app: Express): void {
  app.post(
    "/api/upload/post-media",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
          return;
        }
        const mediaKind = detectPostMediaKind(req.file);
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

        if (s3Configured && req.file.buffer) {
          let buffer: Buffer = req.file.buffer;
          let ext = path.extname(req.file.originalname) || ".jpg";
          let contentType = req.file.mimetype;
          let posterBuffer: Buffer | undefined;
          let posterExt = ".jpg";
          let posterContentType = "image/jpeg";
          if (mediaKind === "video") {
            const transcoded = await transcodeStoryVideoBuffer(buffer, ext, videoTrim, videoProfile);
            buffer = transcoded.buffer;
            ext = transcoded.ext;
            contentType = transcoded.contentType;
            posterBuffer = transcoded.posterBuffer;
            posterExt = transcoded.posterExt ?? posterExt;
            posterContentType = transcoded.posterContentType ?? posterContentType;
          }
          const url =
            mediaKind === "video" && videoProfile === "avatar"
              ? await (async () => {
                  const objectBase = `posts/${randomUUID()}`;
                  const videoUrl = await uploadToS3WithKey(`${objectBase}${ext}`, buffer, contentType);
                  if (posterBuffer) {
                    await uploadToS3WithKey(`${objectBase}${posterExt}`, posterBuffer, posterContentType);
                  }
                  return videoUrl;
                })()
              : await uploadToS3("posts", buffer, contentType, ext);
          res.status(201).json({ url });
          return;
        }

        const file = req.file as Express.Multer.File & { filename?: string; path?: string };
        let filename = file.filename ?? "";
        if (mediaKind === "video" && file.path) {
          const sourcePath = file.path;
          const transcoded = await transcodeStoryVideoFileToPath(sourcePath, UPLOADS_DIR, videoTrim, videoProfile);
          fs.unlink(sourcePath, () => {});
          filename = path.basename(transcoded.videoPath);
        }
        res.status(201).json({ url: `/uploads/posts/${filename}` });
      } catch (err) {
        console.error("Post media upload error:", err);
        const ffmpegLike =
          err instanceof Error &&
          /ffmpeg|libx264|hqdn3d|loudnorm|unsharp|filter|codec|invalid|encoder|decoder|hevc|h\.?265|scale|exited with code|ENOENT|spawn/i.test(
            err.message,
          );
        res.status(500).json({
          message: ffmpegLike
            ? "Не удалось перекодировать видео. Попробуйте экспорт «Совместимость» / MP4 H.264 или проверьте ffmpeg (libx264) на сервере."
            : "Не удалось обработать файл поста",
        });
      }
    }
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
