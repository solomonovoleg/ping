/**
 * Пороги горизонтального свайпа в сториз (ближе к Instagram: короткий драг + флик).
 */
export const STORY_SWIPE_H = {
  /** Минимальная дистанция без учёта скорости */
  commitMinPx: 26,
  /** Флик: последний сегмент */
  velocitySegMinMs: 8,
  velocityCommitPxPerMs: 0.1,
  velocityMinDxPx: 5,
  /** Медленный, но недлинный жест */
  avgGestureMaxMs: 480,
  avgVelocityMinDxPx: 14,
  avgVelocityCommitPxPerMs: 0.038,
} as const;

export const STORY_SWIPE_V = {
  /** Закрытие свайпом вниз — ниже старого 72px, плюс флик вниз */
  closeCommitPx: 54,
  closeFlickMinDyPx: 30,
  closeVelocityPxPerMs: 0.48,
} as const;

function sameSign(a: number, b: number): boolean {
  return (a > 0 && b > 0) || (a < 0 && b < 0);
}

/** Горизонтальный свайп завершён (смена слайда / автора) */
export function storyHorizontalShouldCommit(
  startX: number,
  endX: number,
  lastX: number,
  lastT: number,
  endTime: number,
  startTime: number,
): boolean {
  const dx = endX - startX;
  const adx = Math.abs(dx);
  if (adx >= STORY_SWIPE_H.commitMinPx) return true;

  const dtSeg = Math.max(STORY_SWIPE_H.velocitySegMinMs, endTime - lastT);
  const vxSeg = (endX - lastX) / dtSeg;
  if (
    adx >= STORY_SWIPE_H.velocityMinDxPx &&
    Math.abs(vxSeg) >= STORY_SWIPE_H.velocityCommitPxPerMs &&
    sameSign(dx, vxSeg)
  ) {
    return true;
  }

  const dtTotal = endTime - startTime;
  if (dtTotal <= 0 || dtTotal > STORY_SWIPE_H.avgGestureMaxMs) return false;
  const vxAvg = dx / Math.max(32, dtTotal);
  return (
    adx >= STORY_SWIPE_H.avgVelocityMinDxPx &&
    Math.abs(vxAvg) >= STORY_SWIPE_H.avgVelocityCommitPxPerMs &&
    sameSign(dx, vxAvg)
  );
}

/** Закрытие вертикальным жестом вниз */
export function storyVerticalCloseShouldCommit(
  dy: number,
  absX: number,
  absY: number,
  endY: number,
  lastY: number,
  lastT: number,
  endTime: number,
): boolean {
  if (absY <= absX * 1.1) return false;
  if (dy >= STORY_SWIPE_V.closeCommitPx) return true;
  const dtSeg = Math.max(8, endTime - lastT);
  const vySeg = (endY - lastY) / dtSeg;
  return dy >= STORY_SWIPE_V.closeFlickMinDyPx && vySeg >= STORY_SWIPE_V.closeVelocityPxPerMs;
}
