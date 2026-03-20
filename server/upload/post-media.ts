import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";
import {
  transcodeStoryVideoBuffer,
  transcodeStoryVideoFileToPath,
  validateStoryVideoUpload,
} from "./story-video-transcode";

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
const ALLOWED_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|mp4|webm|mov|mp3|m4a|aac|wav|ogg)$/i;

function detectPostMediaKind(file: Pick<Express.Multer.File, "mimetype" | "originalname">): "image" | "video" | "audio" | "unknown" {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext)) return "image";
  if (/\.(mp4|webm|mov)$/i.test(ext)) return "video";
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
      cb(new Error("Разрешены только фото, видео и аудио (JPEG/PNG/WEBP/HEIC, MP4/MOV/WebM, MP3/M4A/WAV/OGG) до 500 МБ"));
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
          if (mediaKind === "video") {
            const transcoded = await transcodeStoryVideoBuffer(buffer, ext);
            buffer = transcoded.buffer;
            ext = transcoded.ext;
            contentType = transcoded.contentType;
          }
          const url = await uploadToS3("posts", buffer, contentType, ext);
          res.status(201).json({ url });
          return;
        }

        const file = req.file as Express.Multer.File & { filename?: string; path?: string };
        let filename = file.filename ?? "";
        if (mediaKind === "video" && file.path) {
          const sourcePath = file.path;
          const transcodedPath = await transcodeStoryVideoFileToPath(sourcePath, UPLOADS_DIR);
          fs.unlink(sourcePath, () => {});
          filename = path.basename(transcodedPath);
        }
        res.status(201).json({ url: `/uploads/posts/${filename}` });
      } catch (err) {
        console.error("Post media upload error:", err);
        res.status(500).json({ message: "Не удалось обработать файл поста" });
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
