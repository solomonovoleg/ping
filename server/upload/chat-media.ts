import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "chat");
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB для чата
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

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
      cb(new Error("Разрешены только фото (JPEG, PNG, GIF, WebP) и видео (MP4, WebM, MOV)"));
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
      res.status(400).json({ message: "Файл слишком большой (макс. 50 МБ)" });
      return;
    }
    next(err);
  });
}
