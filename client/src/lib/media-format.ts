/**
 * Три формата отображения медиа в ленте:
 * - horizontal — заметный ландшафт (ширина заметно больше высоты);
 * - square — почти квадрат;
 * - story — вытянутый портрет (ближе к 9:16, чем к квадрату).
 *
 * Раньше выбирали «ближайший» к 1:1 / 9:16 / 16:9 — из‑за этого 4:3 горизонталка
 * попадала в square и получала letterbox в квадратной рамке.
 */

export type MediaDisplayFormat = "horizontal" | "square" | "story";

const STORY_RATIO = 9 / 16;
const SQUARE_RATIO = 1;

/** Полоса «почти квадрат» по width/height. */
const NEAR_SQUARE_MIN = 0.92;
const NEAR_SQUARE_MAX = 1.08;

/**
 * Возвращает формат по соотношению сторон (width/height).
 * Учитывать EXIF: для ориентации 6 или 8 передавать уже (logicalWidth, logicalHeight).
 */

export function getMediaDisplayFormat(width: number, height: number): MediaDisplayFormat {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return "square";
  }
  const ratio = width / height;

  if (ratio > NEAR_SQUARE_MAX) {
    return "horizontal";
  }
  if (ratio < NEAR_SQUARE_MIN) {
    const distance = (target: number) => Math.abs(Math.log(ratio) - Math.log(target));
    return distance(STORY_RATIO) <= distance(SQUARE_RATIO) ? "story" : "square";
  }

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
