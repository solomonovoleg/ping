import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";
import { convertHeicBufferToJpeg, convertHeicFileToJpegFile, isHeicLike } from "./heic-convert";
import { formatUploadStorageError } from "./format-upload-storage-error";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "avatars");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ALLOWED_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

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
    const byMime = ALLOWED_MIMES.includes(file.mimetype);
    const byExt = ALLOWED_EXT_RE.test(file.originalname || "");
    if (byMime || byExt) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только фото: JPEG, PNG, GIF, WebP, HEIC/HEIF"));
    }
  },
});

/** Multer для аватара (поле `file`) — переиспользование в админке медиа-студии. */
export const avatarUploadMulter = upload;

/** Сохранить загруженный файл аватара (S3 или диск), вернуть публичный URL. */
export async function persistAvatarUpload(file: Express.Multer.File): Promise<string> {
  if (!s3Configured) ensureDir(UPLOADS_DIR);
  if (s3Configured && file.buffer) {
    let buffer = file.buffer;
    let ext = path.extname(file.originalname) || ".jpg";
    let contentType = file.mimetype;
    if (isHeicLike(contentType, file.originalname)) {
      buffer = await convertHeicBufferToJpeg(buffer);
      ext = ".jpg";
      contentType = "image/jpeg";
    }
    return uploadToS3("avatars", buffer, contentType, ext);
  }
  const f = file as Express.Multer.File & { filename?: string; path?: string };
  let filename = f.filename ?? "";
  if (f.path && isHeicLike(file.mimetype, file.originalname)) {
    const stem = path.basename(f.path, path.extname(f.path));
    const outPath = path.join(UPLOADS_DIR, `${stem}.jpg`);
    await convertHeicFileToJpegFile(f.path, outPath);
    fs.unlink(f.path, () => {});
    filename = `${stem}.jpg`;
  }
  return `/uploads/avatars/${filename}`;
}

export function registerAvatarUploadRoutes(app: Express): void {
  if (!s3Configured) ensureDir(UPLOADS_DIR);
  app.post(
    "/api/upload/avatar",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
          return;
        }
        const url = await persistAvatarUpload(req.file);
        res.status(201).json({ url });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        if (/heic|heif|sharp|libvips|libheif|unsupported image|convert/i.test(raw)) {
          res.status(500).json({
            message: "Не удалось обработать HEIC/HEIF. Сохраните фото как JPEG или PNG.",
          });
          return;
        }
        res.status(503).json({
          message: formatUploadStorageError(err, "[upload/avatar]", {
            storageMode: s3Configured ? "s3" : "disk",
          }),
        });
      }
    }
  );

  app.use((err: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
    if (err && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "Файл слишком большой (макс. 5 МБ)" });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ message: err.message || "Ошибка загрузки аватара" });
      return;
    }
    next(err);
  });
}
