import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "chat");
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_UPLOAD_SIZE = MAX_VIDEO_SIZE; // multer upper bound, exact limits check below
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/x-png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const ALLOWED_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|mp4|webm|mov)$/i;

function detectMediaKind(file: Pick<Express.Multer.File, "mimetype" | "originalname">): "image" | "video" | "unknown" {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = path.extname(file.originalname || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
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
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || "").toLowerCase().trim();
    // iOS/Safari picker can provide empty or non-standard mimetype; fallback by extension.
    const byMime = !!mime && ALLOWED_MIMES.includes(mime);
    const byExt = ALLOWED_EXT_RE.test(file.originalname || "");
    if (byMime || byExt) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только фото (JPEG, PNG, GIF, WebP, HEIC/HEIF) и видео (MP4, WebM, MOV)"));
    }
  },
});

export function registerChatMediaUploadRoutes(app: Express): void {
  app.post(
    "/api/upload/chat-media",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
        return;
      }
      const mediaKind = detectMediaKind(req.file);
      if (mediaKind === "unknown") {
        res.status(400).json({ message: "Не удалось определить тип файла. Загрузите фото или видео." });
        return;
      }
      const maxSize = mediaKind === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      if (req.file.size > maxSize) {
        if (!s3Configured) {
          const filePath = (req.file as Express.Multer.File & { path?: string }).path;
          if (filePath) fs.unlink(filePath, () => {});
        }
        res.status(400).json({
          message:
            mediaKind === "image"
              ? "Фото слишком большое (макс. 50 МБ)"
              : "Видео слишком большое (макс. 500 МБ)",
        });
        return;
      }
      if (s3Configured && req.file.buffer) {
        const ext = path.extname(req.file.originalname) || ".jpg";
        const url = await uploadToS3(
          "chat",
          req.file.buffer,
          req.file.mimetype,
          ext
        );
        res.status(201).json({ url });
        return;
      }
      const filename = (req.file as Express.Multer.File & { filename?: string }).filename ?? "";
      const url = `/uploads/chat/${filename}`;
      res.status(201).json({ url });
    }
  );

  app.use((err: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
    if (err && (err as any).code === "LIMIT_FILE_SIZE") {
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
