/** Смещение контента при горизонтальном drag (как в Instagram). */
export function computeStoryParallaxTx(
  dragX: number,
  vw: number,
  opts: {
    hasNextPeek: boolean;
    hasPrevPeek: boolean;
    atLastNoNext: boolean;
    atFirstNoPrev: boolean;
  },
): number {
  const d = dragX;
  const cap = vw * 0.36;
  const hasPeek = opts.hasNextPeek || opts.hasPrevPeek;
  const followK = hasPeek ? 0.44 : 0.14;
  if (opts.atLastNoNext && d < 0) {
    return Math.max(Math.min(d * 0.26, -18), -Math.min(64, cap));
  }
  if (opts.atFirstNoPrev && d > 0) {
    return Math.min(Math.max(d * 0.26, 18), Math.min(64, cap));
  }
  return Math.max(-cap, Math.min(cap, d * followK));
}

/** Ширина полоски-превью соседней сториз при перетягивании */
export function computeStoryPeekStripWidth(absDragX: number, vw: number): number {
  return Math.min(vw * 0.52, 30 + absDragX * 0.52);
}
