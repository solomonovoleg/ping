import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { s3Configured, uploadToS3 } from "../upload/s3";
import { compressStickerImageBuffer } from "./compress-sticker";
import { STICKER_MAX_FILE_BYTES, STICKER_MAX_FILES_PER_REQUEST, STICKERS_UPLOAD_DIR } from "./sticker-constants";

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

let uploadDirEnsured = false;

/** Вызывать при регистрации маршрутов: гарантирует каталог для локального режима без S3. */
export function ensureStickerUploadPrepared(): void {
  if (uploadDirEnsured) return;
  if (!s3Configured && !fs.existsSync(STICKERS_UPLOAD_DIR)) {
    fs.mkdirSync(STICKERS_UPLOAD_DIR, { recursive: true });
  }
  uploadDirEnsured = true;
}

const memoryStorage = multer.memoryStorage();

const stickerMulter = multer({
  storage: memoryStorage,
  limits: { fileSize: STICKER_MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    const mime = (file.mimetype || "").toLowerCase().trim();
    const ext = path.extname(file.originalname || "").toLowerCase();
    const byMime = ALLOWED_MIMES.has(mime);
    const byExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"].includes(ext);
    if (byMime || byExt) cb(null, true);
    else cb(new Error("Разрешены только изображения (JPEG, PNG, WebP, GIF, HEIC)"));
  },
});

export function stickerFilesUploadMiddleware() {
  return stickerMulter.array("files", STICKER_MAX_FILES_PER_REQUEST);
}

export async function persistStickerBuffersToStorage(buffers: Buffer[]): Promise<string[]> {
  const urls: string[] = [];
  for (const buf of buffers) {
    const { buffer, contentType } = await compressStickerImageBuffer(buf);
    if (s3Configured) {
      urls.push(await uploadToS3("stickers", buffer, contentType, ".webp"));
    } else {
      if (!fs.existsSync(STICKERS_UPLOAD_DIR)) {
        fs.mkdirSync(STICKERS_UPLOAD_DIR, { recursive: true });
      }
      const name = `${randomUUID()}.webp`;
      const fp = path.join(STICKERS_UPLOAD_DIR, name);
      await fs.promises.writeFile(fp, buffer);
      urls.push(`/uploads/stickers/${name}`);
    }
  }
  return urls;
}
