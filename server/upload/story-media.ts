import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../auth/session";
import { s3Configured, uploadToS3 } from "./s3";
import { formatUploadStorageError } from "./format-upload-storage-error";
import { STORY_VIDEO_MAX_SECONDS } from "@shared/post-video";
import {
  transcodeStoryVideoBuffer,
  transcodeStoryVideoFileToPath,
  validateStoryVideoUpload,
  type VideoTranscodeTrim,
} from "./story-video-transcode";
import { convertHeicBufferToJpeg, convertHeicFileToJpegFile, isHeicLike } from "./heic-convert";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "stories");
const MAX_SIZE = 500 * 1024 * 1024;
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
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|wmv|flv|ts|m2ts|mts|ogv|mpeg|mpg)$/i;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseStoryVideoTrim(body: Record<string, unknown> | undefined): VideoTranscodeTrim | undefined {
  if (!body) return undefined;
  const s = body.trimStartSec;
  const d = body.trimDurationSec;
  const hasS = s !== undefined && s !== null && String(s).trim() !== "";
  const hasD = d !== undefined && d !== null && String(d).trim() !== "";
  if (!hasS || !hasD) return undefined;
  const startSec = Math.max(0, Number.parseFloat(String(s)) || 0);
  let durationSec = Number.parseFloat(String(d));
  if (!Number.isFinite(durationSec)) durationSec = STORY_VIDEO_MAX_SECONDS;
  durationSec = Math.min(STORY_VIDEO_MAX_SECONDS, Math.max(0.1, durationSec));
  return { startSec, durationSec, maxSegmentSec: STORY_VIDEO_MAX_SECONDS };
}

function detectMediaKind(file: Pick<Express.Multer.File, "mimetype" | "originalname">): "image" | "video" | "unknown" {
  const mime = (file.mimetype || "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (IMAGE_EXT_RE.test(ext)) return "image";
  if (VIDEO_EXT_RE.test(ext)) return "video";
  return "unknown";
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
    const byImageMime = !!mime && ALLOWED_MIMES.includes(mime);
    const byVideoMime = !!mime && mime.startsWith("video/");
    const byImageExt = IMAGE_EXT_RE.test(file.originalname || "");
    const byVideoExt = VIDEO_EXT_RE.test(file.originalname || "");
    if (!(byImageMime || byVideoMime || byImageExt || byVideoExt)) {
      cb(new Error("Для сториз разрешены только фото и видео"));
      return;
    }
    cb(null, true);
  },
});

export function registerStoryMediaUploadRoutes(app: Express): void {
  app.post(
    "/api/upload/story-media",
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
          res.status(400).json({ message: "Для сториз доступны только фото и видео" });
          return;
        }

        if (mediaKind === "video") {
          const videoErr = validateStoryVideoUpload(req.file);
          if (videoErr) {
            res.status(400).json({ message: videoErr });
            return;
          }
        }

        const storyVideoTrim =
          mediaKind === "video" ? parseStoryVideoTrim(req.body as Record<string, unknown>) : undefined;

        if (s3Configured && req.file.buffer) {
          let buffer = req.file.buffer;
          let ext = path.extname(req.file.originalname) || ".jpg";
          let contentType = req.file.mimetype;
          if (mediaKind === "video") {
            const transcoded = await transcodeStoryVideoBuffer(buffer, ext, storyVideoTrim);
            buffer = transcoded.buffer;
            ext = transcoded.ext;
            contentType = transcoded.contentType;
          } else if (mediaKind === "image" && isHeicLike(contentType, req.file.originalname)) {
            buffer = await convertHeicBufferToJpeg(buffer);
            ext = ".jpg";
            contentType = "image/jpeg";
          }
          const url = await uploadToS3("stories", buffer, contentType, ext);
          res.status(201).json({ url });
          return;
        }

        const file = req.file as Express.Multer.File & { filename?: string; path?: string };
        let filename = file.filename ?? "";
        if (mediaKind === "video" && file.path) {
          const sourcePath = file.path;
          const transcoded = await transcodeStoryVideoFileToPath(sourcePath, UPLOADS_DIR, storyVideoTrim);
          fs.unlink(sourcePath, () => {});
          filename = path.basename(transcoded.videoPath);
        } else if (mediaKind === "image" && file.path && isHeicLike(file.mimetype, file.originalname)) {
          const stem = path.basename(file.path, path.extname(file.path));
          const outPath = path.join(UPLOADS_DIR, `${stem}.jpg`);
          await convertHeicFileToJpegFile(file.path, outPath);
          fs.unlink(file.path, () => {});
          filename = `${stem}.jpg`;
        }
        res.status(201).json({ url: `/uploads/stories/${filename}` });
      } catch (err) {
        console.error("Story media upload error:", err);
        const transcodeLike =
          err instanceof Error &&
          /ffmpeg|libx264|hqdn3d|loudnorm|unsharp|filter|codec|invalid|encoder|decoder|hevc|h\.?265|scale|exited with code|ENOENT|spawn|\bsharp\b|libvips|heif|heic|unsupported image/i.test(
            err.message,
          );
        if (transcodeLike) {
          res.status(500).json({
            message:
              "Не удалось обработать сториз. HEIC: sharp/libvips+HEIF или ffmpeg+libheif; видео: MP4 H.264, ffmpeg libx264.",
          });
          return;
        }
        res.status(503).json({
          message: formatUploadStorageError(err, "[upload/story-media]", {
            storageMode: s3Configured ? "s3" : "disk",
          }),
        });
      }
    }
  );
}
