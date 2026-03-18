/**
 * Три формата отображения медиа в ленте:
 * - horizontal — горизонтальное (ширина > высоты);
 * - square — квадрат (1:1);
 * - story — вертикальное сториз (9:16 и уже).
 *
 * Пороговая логика: по соотношению сторон (width/height) без привязки к «ближайшему» канону,
 * чтобы горизонтальные фото не уезжали в сториз.
 */

export type MediaDisplayFormat = "horizontal" | "square" | "story";

/** Ниже этого ratio считаем сториз (вертикаль). */
const RATIO_STORY_MAX = 0.85;
/** Выше этого ratio считаем горизонталь. */
const RATIO_HORIZONTAL_MIN = 1.15;

/**
 * Возвращает формат по соотношению сторон (width/height).
 * Учитывать EXIF: для ориентации 6 или 8 передавать уже (logicalWidth, logicalHeight).
 */
export function getMediaDisplayFormat(width: number, height: number): MediaDisplayFormat {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return "square";
  }
  const ratio = width / height;

  if (ratio <= RATIO_STORY_MAX) return "story";
  if (ratio >= RATIO_HORIZONTAL_MIN) return "horizontal";
  return "square";
}

/**
 * Возвращает CSS aspect-ratio для контейнера в формате "width/height".
 * horizontal — контейнер по ширине, высота по контенту (не фиксируем 16:9, чтобы не обрезать ещё более широкие фото).
 */
export function getMediaAspectRatio(format: MediaDisplayFormat): string | null {
  switch (format) {
    case "horizontal":
      return null; // естественная пропорция изображения, без фиксированного aspect
    case "square":
      return "1/1";
    case "story":
      return "9/16";
    default:
      return null;
  }
}
