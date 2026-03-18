import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "avatars");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только фото: JPEG, PNG, GIF, WebP"));
    }
  },
});

export function registerAvatarUploadRoutes(app: Express): void {
  if (!s3Configured) ensureDir(UPLOADS_DIR);
  app.post(
    "/api/upload/avatar",
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
          "avatars",
          req.file.buffer,
          req.file.mimetype,
          ext
        );
        res.status(201).json({ url });
        return;
      }
      const filename = (req.file as Express.Multer.File & { filename?: string }).filename ?? "";
      const url = `/uploads/avatars/${filename}`;
      res.status(201).json({ url });
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
