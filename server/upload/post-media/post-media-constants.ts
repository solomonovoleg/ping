import path from "path";
import fs from "fs";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads", "posts");
export const MAX_SIZE = 500 * 1024 * 1024; // 500 MB (видео MOV/MP4 до 500 МБ)

export const ALLOWED_MIMES = [
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
  "video/x-m4v",
  "video/m4v",
  "video/3gpp",
  "video/3gp",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
] as const;

export const ALLOWED_EXT_RE =
  /\.(jpe?g|png|gif|webp|heic|heif|mp4|webm|mov|m4v|3gp|3gpp|mp3|m4a|aac|wav|ogg)$/i;

export function ensurePostMediaUploadDir(dir: string = UPLOADS_DIR): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
