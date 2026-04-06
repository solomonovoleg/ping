import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";
import { buildSignedUploadPath } from "../security/upload-access-signature";
import { formatUploadStorageError } from "./format-upload-storage-error";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "voice");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/wav",
];
const ALLOWED_EXT_RE = /\.(webm|ogg|mp4|m4a|aac|mp3|wav|caf)$/i;

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
    let ext = path.extname(file.originalname);
    if (!ext || ext === ".") {
      ext = file.mimetype?.includes("mp4") || file.mimetype?.includes("m4a") ? ".m4a" : ".webm";
    }
    cb(null, `${randomUUID()}${ext}`);
  },
});

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: s3Configured ? memoryStorage : diskStorage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    const mt = (file.mimetype || "").toLowerCase();
    const byMime = ALLOWED_MIMES.includes(mt) || mt.startsWith("audio/");
    // iOS WebView can send application/octet-stream for voice blobs; fallback by file extension.
    const byExt = ALLOWED_EXT_RE.test(file.originalname || "");
    if (byMime || byExt) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только аудиофайлы (webm, ogg, mp4, m4a, aac, mp3, wav)"));
    }
  },
});

export function registerVoiceUploadRoutes(app: Express): void {
  app.get("/api/upload/voice/sign", requireAuth, (req: Request, res: Response) => {
    const rawPath = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath || !rawPath.startsWith("/uploads/voice/")) {
      res.status(400).json({ message: "path должен начинаться с /uploads/voice/" });
      return;
    }
    const ttlSecRaw = Number.parseInt(String(req.query.ttlSec ?? ""), 10);
    const ttlSec = Number.isFinite(ttlSecRaw) && ttlSecRaw > 0 ? Math.min(ttlSecRaw, 3600) : 900;
    res.json({ signedPath: buildSignedUploadPath(rawPath, ttlSec), expiresInSec: ttlSec });
  });

  app.post(
    "/api/upload/voice",
    requireAuth,
    upload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ message: "Файл не загружен. Отправьте поле «audio»." });
          return;
        }
        if (s3Configured && req.file.buffer) {
          let ext = path.extname(req.file.originalname);
          if (!ext || ext === ".") {
            ext = req.file.mimetype?.includes("mp4") || req.file.mimetype?.includes("m4a") ? ".m4a" : ".webm";
          }
          const url = await uploadToS3("voice", req.file.buffer, req.file.mimetype, ext);
          res.status(201).json({ url });
          return;
        }
        const filename = (req.file as Express.Multer.File & { filename?: string }).filename ?? "";
        const url = `/uploads/voice/${filename}`;
        res.status(201).json({ url, signedUrl: buildSignedUploadPath(url) });
      } catch (err) {
        res.status(503).json({
          message: formatUploadStorageError(err, "[upload/voice] S3/disk", {
            storageMode: s3Configured ? "s3" : "disk",
          }),
        });
      }
    }
  );

  app.use((err: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
    if (err && (err as any).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "Файл слишком большой (макс. 10 МБ)" });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ message: err.message || "Ошибка загрузки голосового" });
      return;
    }
    next(err);
  });
}
