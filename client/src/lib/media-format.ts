/**
 * Три формата отображения медиа в ленте:
 * - horizontal — горизонтальное (ширина > высоты);
 * - square — квадрат (1:1);
 * - story — вертикальное сториз (9:16 и уже).
 *
 * Логика выбора: по ближайшему каноническому ratio.
 * Каноны:
 * - story: 9/16
 * - square: 1/1
 * - horizontal: 16/9
 */

export type MediaDisplayFormat = "horizontal" | "square" | "story";

const STORY_RATIO = 9 / 16;
const SQUARE_RATIO = 1;
const HORIZONTAL_RATIO = 16 / 9;

/**
 * Возвращает формат по соотношению сторон (width/height).
 * Учитывать EXIF: для ориентации 6 или 8 передавать уже (logicalWidth, logicalHeight).
 */
export function getMediaDisplayFormat(width: number, height: number): MediaDisplayFormat {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return "square";
  }
  const ratio = width / height;
  const distance = (target: number) => Math.abs(Math.log(ratio) - Math.log(target));

  const distances: Array<{ format: MediaDisplayFormat; d: number }> = [
    { format: "story", d: distance(STORY_RATIO) },
    { format: "square", d: distance(SQUARE_RATIO) },
    { format: "horizontal", d: distance(HORIZONTAL_RATIO) },
  ];
  distances.sort((a, b) => a.d - b.d);
  return distances[0]?.format ?? "square";
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
