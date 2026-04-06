import { randomUUID } from "crypto";
import path from "path";
import multer from "multer";
import { s3Configured } from "../s3";
import { ALLOWED_EXT_RE, ALLOWED_MIMES, ensurePostMediaUploadDir, MAX_SIZE, UPLOADS_DIR } from "./post-media-constants";

const diskStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensurePostMediaUploadDir();
    cb(null, UPLOADS_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const memoryStorage = multer.memoryStorage();

export const postMediaUpload = multer({
  storage: s3Configured ? memoryStorage : diskStorage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || "").toLowerCase().trim();
    const byMime = !!mime && (ALLOWED_MIMES as readonly string[]).includes(mime);
    const byExt = ALLOWED_EXT_RE.test(file.originalname || "");
    if (!byMime && !byExt) {
      cb(
        new Error(
          "Разрешены только фото, видео и аудио (JPEG/PNG/WEBP/HEIC, MP4/MOV/WebM/M4V/3GP, MP3/M4A/WAV/OGG) до 500 МБ",
        ),
      );
      return;
    }
    cb(null, true);
  },
});
