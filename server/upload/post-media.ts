import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";

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
      if (!req.file) {
        res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
        return;
      }
      if (s3Configured && req.file.buffer) {
        const ext = path.extname(req.file.originalname) || ".jpg";
        const url = await uploadToS3(
          "posts",
          req.file.buffer,
          req.file.mimetype,
          ext
        );
        res.status(201).json({ url });
        return;
      }
      const filename = (req.file as Express.Multer.File & { filename?: string }).filename ?? "";
      const url = `/uploads/posts/${filename}`;
      res.status(201).json({ url });
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
