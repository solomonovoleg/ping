import type { PostMediaDetectedKind } from "./detect-post-media-kind";
import type { UploadStorageMode } from "../format-upload-storage-error";
import { formatUploadStorageError } from "../format-upload-storage-error";

function errnoCode(err: unknown): string {
  if (!err || typeof err !== "object" || !("code" in err)) return "";
  const c = (err as { code?: unknown }).code;
  return typeof c === "string" ? c.toUpperCase() : "";
}

/** Диск, права, лимиты ОС и явные сообщения о неполной настройке S3 — до эвристик ffmpeg/sharp. */
function mapSystemOrConfigUploadError(err: unknown, errMsg: string): string | null {
  const code = errnoCode(err);
  if (code === "ENOSPC") {
    return "На сервере закончилось место на диске. Освободите место или расширьте том с загрузками.";
  }
  if (code === "EACCES" || code === "EPERM") {
    return "Сервер не может записать файл (нет прав). Проверьте владельца и права на каталог загрузок (uploads).";
  }
  if (code === "EROFS") {
    return "Файловая система только для чтения — сохранить файл нельзя.";
  }
  if (code === "EMFILE" || code === "ENFILE") {
    return "На сервере исчерпан лимит открытых файлов. Перезапустите процесс или увеличьте ulimit.";
  }
  const lower = errMsg.toLowerCase();
  if (lower.includes("no space left") || lower.includes("enospc")) {
    return "На сервере закончилось место на диске. Попробуйте позже или сообщите администратору.";
  }
  if (/^s3:\s/i.test(errMsg.trim()) && /переменн|endpoint|bucket|credentials/i.test(errMsg)) {
    return "Облачное хранилище не настроено: на сервере задайте S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY (см. .env.example).";
  }
  return null;
}

export function mapPostMediaUploadErrorMessage(params: {
  err: unknown;
  mediaKind: PostMediaDetectedKind | undefined;
  heicConversionAttempted: boolean;
  hasFile: boolean;
  storageMode: UploadStorageMode;
}): string {
  const { err, mediaKind, heicConversionAttempted, hasFile, storageMode } = params;
  const errMsg = err instanceof Error ? err.message : String(err);
  const systemOrConfig = mapSystemOrConfigUploadError(err, errMsg);
  if (systemOrConfig) return systemOrConfig;

  const transcodeLike =
    /ffmpeg|libx264|hqdn3d|loudnorm|unsharp|filter|codec|invalid|encoder|decoder|hevc|h\.?265|scale|exited with code|ENOENT|spawn|\bsharp\b|libvips|heif|heic|unsupported image/i.test(
      errMsg,
    );

  if (transcodeLike) {
    const heic = mediaKind === "image" && hasFile && heicConversionAttempted;
    if (heic) {
      return "Не удалось обработать фото HEIC/HEIF. На сервере нужен ffmpeg со встроенным декодером libheif или sharp/libvips с поддержкой HEIF (см. scripts/server-setup.sh).";
    }
    if (mediaKind === "video") {
      return "Не удалось обработать видео. Нужен ffmpeg с кодером libx264 и поддержкой вашего входного формата; при проблемах экспортируйте в MP4 H.264.";
    }
    return "Не удалось обработать медиа. Для HEIC нужны sharp/libvips с HEIF или ffmpeg с libheif; для видео — MP4 H.264 и ffmpeg (libx264).";
  }

  if (process.env.NODE_ENV === "development") {
    return `Не удалось обработать файл поста: ${errMsg}`;
  }
  return formatUploadStorageError(err, "[upload/post-media]", { storageMode });
}
