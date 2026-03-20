/** Расширение в пути URL (после resolveUrl), как у `/uploads/posts/<uuid>.mp4` */
const STORY_VIDEO_PATH_RE = /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i;
const STORY_VIDEO_FILENAME_RE = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|wmv|flv|ts|m2ts|mts|ogv|mpeg|mpg)$/i;
const STORY_VIDEO_MIME_RE = /^video\//i;

export const STORY_VIDEO_MAX_SIZE_MB = 500;
const STORY_VIDEO_MAX_SIZE_BYTES = STORY_VIDEO_MAX_SIZE_MB * 1024 * 1024;

export function isLikelyStoryVideoUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  try {
    const path = new URL(u, "http://local.invalid").pathname;
    return STORY_VIDEO_PATH_RE.test(path);
  } catch {
    return STORY_VIDEO_PATH_RE.test(u);
  }
}

/**
 * Проверка видеофайла для сториз:
 * - любой видеоформат (сервер перекодирует в MP4),
 * - ограничение размера для быстрого старта воспроизведения.
 */
export function validateStoryVideoFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const fileName = (file.name || "").trim();
  const mime = (file.type || "").trim();
  const byMime = STORY_VIDEO_MIME_RE.test(mime);
  const byExt = STORY_VIDEO_FILENAME_RE.test(fileName);
  if (!byMime && !byExt) {
    return "Выберите видеофайл";
  }
  if (file.size > STORY_VIDEO_MAX_SIZE_BYTES) {
    return `Видео для сториз должно быть не больше ${STORY_VIDEO_MAX_SIZE_MB} МБ`;
  }
  return null;
}
