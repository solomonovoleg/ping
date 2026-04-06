/** Прогресс анимации в [0, 1]. */
export function easeOutCubic(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return 1 - (1 - p) ** 3;
}

export function statCountAtProgress(progress: number, target: number): number {
  return Math.round(easeOutCubic(progress) * target);
}
