export function computeReelsFloorIndex(scrollTop: number, viewportH: number, length: number): number {
  if (length <= 0 || viewportH <= 0) return 0;
  const raw = Math.floor(scrollTop / viewportH + 1e-9);
  return Math.max(0, Math.min(length - 1, raw));
}

export function computeReelsScrollP(scrollTop: number, floorIdx: number, viewportH: number): number {
  if (viewportH <= 0) return 0;
  const p = (scrollTop - floorIdx * viewportH) / viewportH;
  return Math.max(0, Math.min(1, p));
}

/** Не больше трёх `<video>`: текущий «этаж» по floor(scrollTop) ± 1. */
export function shouldMountReelVideoAt(slideIndex: number, floorIdx: number, length: number): boolean {
  return slideIndex >= floorIdx - 1 && slideIndex <= floorIdx + 1 && slideIndex >= 0 && slideIndex < length;
}

/**
 * Пул из трёх `<video>` всегда привязан к `anchorIdx` (активный слайд), не к `floor(scrollTop)`:
 * при инерции/snap `floorIdx` может отставать от `activeIndex`, и сосед ошибочно получал `preload="none"` → чёрный кадр.
 *
 * Соседи (−1 / +1): всегда `auto`, чтобы следующий ролик был в буфере до свайпа (без паузы ~0.5s на metadata).
 */
export function reelsVideoPreloadLevel(slideIndex: number, anchorIdx: number): "none" | "metadata" | "auto" {
  const d = slideIndex - anchorIdx;
  if (d === 0) return "auto";
  if (d === 1 || d === -1) return "auto";
  return "none";
}

/**
 * Индексы для `<link rel="preload" as="video">` вне окна монтирования (+2/+3 и −2/−3).
 * Без порога по `p`: держим байты в HTTP-кеше заранее, чтобы быстрый свайп через несколько роликов не холодный старт.
 */
export function reelsDistantVideoPreloadIndices(floorIdx: number, _p: number, length: number): number[] {
  const s = new Set<number>();
  if (floorIdx + 3 < length) s.add(floorIdx + 3);
  if (floorIdx + 2 < length) s.add(floorIdx + 2);
  if (floorIdx - 3 >= 0) s.add(floorIdx - 3);
  if (floorIdx - 2 >= 0) s.add(floorIdx - 2);
  return [...s];
}
