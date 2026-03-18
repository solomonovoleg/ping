import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";

const log = (msg: string, err?: unknown) => {
  const prefix = "[upload/cover]";
  if (err !== undefined) console.warn(prefix, msg, err);
  else console.log(prefix, msg);
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "covers");
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
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
    // iOS WebView may send empty/unknown mimetype for HEIC from picker; fallback by filename extension.
    const byExt = ALLOWED_EXT_RE.test(file.originalname || "");
    if (byMime || byExt) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только фото: JPEG, PNG, GIF, WebP, HEIC/HEIF"));
    }
  },
});

export function registerCoverUploadRoutes(app: Express): void {
  if (!s3Configured) ensureDir(UPLOADS_DIR);
  app.post(
    "/api/upload/cover",
    (req, _res, next) => {
      log(`request received, content-type=${req.headers["content-type"] ?? "?"}`);
      next();
    },
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response, next: (err?: unknown) => void) => {
      if (!req.file) {
        log("cover upload: no file in request");
        res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
        return;
      }
      log(`cover upload: file received, mimetype=${req.file.mimetype}, size=${(req.file as Express.Multer.File & { size?: number }).size ?? req.file.buffer?.length ?? "?"}`);
      try {
        if (s3Configured && req.file.buffer) {
          const ext = path.extname(req.file.originalname) || ".jpg";
          const url = await uploadToS3(
            "covers",
            req.file.buffer,
            req.file.mimetype,
            ext
          );
          log("cover upload: success (S3)", url);
          res.status(201).json({ url });
          return;
        }
        const filename = (req.file as Express.Multer.File & { filename?: string }).filename ?? "";
        const url = `/uploads/covers/${filename}`;
        log("cover upload: success (disk)", url);
        res.status(201).json({ url });
      } catch (e) {
        log("cover upload: error", e);
        next(e);
      }
    }
  );

  app.use((err: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
    if (err && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
      log("cover upload: LIMIT_FILE_SIZE");
      res.status(400).json({ message: "Файл слишком большой (макс. 50 МБ)" });
      return;
    }
    if (err instanceof Error) {
      log("cover upload: rejected", err.message);
      res.status(400).json({ message: err.message || "Ошибка загрузки шапки" });
      return;
    }
    next(err);
  });
}
