import path from "path";

export type PostMediaDetectedKind = "image" | "video" | "audio" | "unknown";

/** Поля файла от multer (без Express.Multer — в проекте tsc не подхватывает merge с @types/multer). */
export type PostMediaUploadFile = {
  mimetype?: string;
  originalname: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
};

export function detectPostMediaKind(file: PostMediaUploadFile | { mimetype?: string; originalname?: string }): PostMediaDetectedKind {
  const mime = (file.mimetype ?? "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = path.extname(file.originalname ?? "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext)) return "image";
  if (/\.(mp4|webm|mov|m4v|3gp|3gpp)$/i.test(ext)) return "video";
  if (/\.(mp3|m4a|aac|wav|ogg)$/i.test(ext)) return "audio";
  return "unknown";
}
