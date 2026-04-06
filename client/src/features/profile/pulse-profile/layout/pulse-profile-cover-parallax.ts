const PARALLAX_MULT = 0.38;
const PARALLAX_CAP_PX = 28;

/** Сдвиг обложки при скролле (как раньше: `Math.min(scrollY * 0.38, 28)`). */
export function pulseProfileCoverParallaxY(scrollY: number): number {
  return Math.min(scrollY * PARALLAX_MULT, PARALLAX_CAP_PX);
}
