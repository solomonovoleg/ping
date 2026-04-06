import path from "path";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { spawn } from "child_process";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3WithKey } from "./s3";
import { convertHeicBufferToJpeg, convertHeicFileToJpegFile, isHeicLike } from "./heic-convert";
import { getFfmpegExecutable } from "../lib/ffmpeg-bin";
import { buildSignedUploadPath } from "../security/upload-access-signature";
import { formatUploadStorageError } from "./format-upload-storage-error";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "chat");
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_PDF_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10 MB (таблицы из чата)
const MAX_XLSX_SIZE = 10 * 1024 * 1024; // 10 MB
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
  "application/pdf",
  "text/csv",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|mp4|webm|mov|pdf|csv|xlsx)$/i;

function detectMediaKind(
  file: Pick<Express.Multer.File, "mimetype" | "originalname">
): "image" | "video" | "document" | "unknown" {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime === "application/pdf" || mime === "application/x-pdf") return "document";
  if (mime === "text/csv" || mime === "application/csv") return "document";
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext === ".pdf" || ext === ".csv" || ext === ".xlsx") return "document";
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
  return "unknown";
}

function isChatCsvFile(file: Pick<Express.Multer.File, "mimetype" | "originalname">): boolean {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime === "text/csv" || mime === "application/csv") return true;
  return path.extname(file.originalname || "").toLowerCase() === ".csv";
}

function isChatXlsxFile(file: Pick<Express.Multer.File, "mimetype" | "originalname">): boolean {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true;
  return path.extname(file.originalname || "").toLowerCase() === ".xlsx";
}

function chatDocumentMaxBytes(file: Express.Multer.File): number {
  if (isChatXlsxFile(file)) return MAX_XLSX_SIZE;
  if (isChatCsvFile(file)) return MAX_CSV_SIZE;
  return MAX_PDF_SIZE;
}

function chatDocumentTooLargeMessage(file: Express.Multer.File): string {
  if (isChatCsvFile(file)) return "CSV слишком большой (макс. 10 МБ)";
  if (isChatXlsxFile(file)) return "Файл Excel слишком большой (макс. 10 МБ)";
  return "PDF слишком большой (макс. 15 МБ)";
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function posterFileNameFromFileName(name: string): string {
  const ext = path.extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  return `${stem}.poster.jpg`;
}

async function runFfmpegPoster(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "0.10",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(640,iw)':'min(640,ih)':force_original_aspect_ratio=decrease",
      "-q:v",
      "4",
      outputPath,
    ];
    const child = spawn(getFfmpegExecutable(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `ffmpeg exited with code ${code ?? "unknown"}`));
    });
  });
}

async function extractPosterBufferFromVideoBuffer(videoBuffer: Buffer, inputExt: string): Promise<Buffer | null> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "chat-video-poster-"));
  const inputPath = path.join(tempDir, `input${inputExt || ".mp4"}`);
  const outputPath = path.join(tempDir, "poster.jpg");
  try {
    await fs.promises.writeFile(inputPath, videoBuffer);
    await runFfmpegPoster(inputPath, outputPath);
    return await fs.promises.readFile(outputPath);
  } catch (err) {
    console.warn("[upload/chat-media] poster extraction failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractPosterFileForLocalVideo(filePath: string, outputPath: string): Promise<boolean> {
  try {
    await runFfmpegPoster(filePath, outputPath);
    return true;
  } catch (err) {
    console.warn("[upload/chat-media] local poster extraction failed:", err instanceof Error ? err.message : err);
    return false;
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
      cb(
        new Error(
          "Разрешены только фото (JPEG, PNG, GIF, WebP, HEIC/HEIF), видео (MP4, WebM, MOV), PDF до 15 МБ, CSV и XLSX до 10 МБ"
        )
      );
    }
  },
});

export function registerChatMediaUploadRoutes(app: Express): void {
  app.get("/api/upload/chat-media/sign", requireAuth, (req: Request, res: Response) => {
    const rawPath = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath || !rawPath.startsWith("/uploads/chat/")) {
      res.status(400).json({ message: "path должен начинаться с /uploads/chat/" });
      return;
    }
    const ttlSecRaw = Number.parseInt(String(req.query.ttlSec ?? ""), 10);
    const ttlSec = Number.isFinite(ttlSecRaw) && ttlSecRaw > 0 ? Math.min(ttlSecRaw, 3600) : 900;
    res.json({ signedPath: buildSignedUploadPath(rawPath, ttlSec), expiresInSec: ttlSec });
  });

  app.post(
    "/api/upload/chat-media",
    requireAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ message: "Файл не загружен. Отправьте поле «file»." });
          return;
        }
        const mediaKind = detectMediaKind(req.file);
        if (mediaKind === "unknown") {
          res.status(400).json({ message: "Не удалось определить тип файла. Загрузите фото, видео, PDF, CSV или XLSX." });
          return;
        }
        const docMax = mediaKind === "document" ? chatDocumentMaxBytes(req.file) : MAX_PDF_SIZE;
        const maxSize =
          mediaKind === "image" ? MAX_IMAGE_SIZE : mediaKind === "document" ? docMax : MAX_VIDEO_SIZE;
        if (req.file.size > maxSize) {
          if (!s3Configured) {
            const filePath = (req.file as Express.Multer.File & { path?: string }).path;
            if (filePath) fs.unlink(filePath, () => {});
          }
          const docMsg =
            mediaKind === "document" ? chatDocumentTooLargeMessage(req.file) : "PDF слишком большой (макс. 15 МБ)";
          res.status(400).json({
            message:
              mediaKind === "image"
                ? "Фото слишком большое (макс. 50 МБ)"
                : mediaKind === "document"
                  ? docMsg
                  : "Видео слишком большое (макс. 500 МБ)",
          });
          return;
        }
        if (s3Configured && req.file.buffer) {
          let buffer = req.file.buffer;
          let ext = path.extname(req.file.originalname) || ".jpg";
          let contentType = req.file.mimetype;
          if (mediaKind === "image" && isHeicLike(contentType, req.file.originalname)) {
            buffer = await convertHeicBufferToJpeg(buffer);
            ext = ".jpg";
            contentType = "image/jpeg";
          }
          const key = `chat/${randomUUID()}${ext}`;
          const url = await uploadToS3WithKey(key, buffer, contentType);
          if (mediaKind !== "video") {
            res.status(201).json({ url, kind: mediaKind === "document" ? "pdf" : mediaKind });
            return;
          }
          const posterBuffer = await extractPosterBufferFromVideoBuffer(buffer, ext);
          if (!posterBuffer) {
            res.status(201).json({ url });
            return;
          }
          const posterKey = key.replace(/\.[^./]+$/, ".poster.jpg");
          const posterUrl = await uploadToS3WithKey(posterKey, posterBuffer, "image/jpeg");
          res.status(201).json({ url, posterUrl });
          return;
        }
        const file = req.file as Express.Multer.File & { filename?: string; path?: string };
        let filename = file.filename ?? "";
        if (mediaKind === "image" && file.path && isHeicLike(file.mimetype, file.originalname)) {
          const stem = path.basename(file.path, path.extname(file.path));
          const outPath = path.join(UPLOADS_DIR, `${stem}.jpg`);
          await convertHeicFileToJpegFile(file.path, outPath);
          fs.unlink(file.path, () => {});
          filename = `${stem}.jpg`;
        }
        const url = `/uploads/chat/${filename}`;
        const signedUrl = buildSignedUploadPath(url);
        if (mediaKind !== "video" || !file.path) {
          res.status(201).json({ url, signedUrl, kind: mediaKind === "document" ? "pdf" : mediaKind });
          return;
        }
        const posterFileName = posterFileNameFromFileName(filename);
        const posterPath = path.join(UPLOADS_DIR, posterFileName);
        const posterOk = await extractPosterFileForLocalVideo(file.path, posterPath);
        if (!posterOk) {
          res.status(201).json({ url, signedUrl });
          return;
        }
        const posterUrl = `/uploads/chat/${posterFileName}`;
        res.status(201).json({
          url,
          signedUrl,
          posterUrl,
          posterSignedUrl: buildSignedUploadPath(posterUrl),
        });
      } catch (err) {
        res.status(503).json({
          message: formatUploadStorageError(err, "[upload/chat-media]", {
            storageMode: s3Configured ? "s3" : "disk",
          }),
        });
      }
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
