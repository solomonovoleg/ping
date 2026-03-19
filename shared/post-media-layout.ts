export type PostMediaLayout = {
  version: 1;
  items: Array<{
    index: number;
    aspectRatio: number;
  }>;
};

function normalizeAspectRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(3, Math.max(0.33, value));
}

/**
 * Build a compact serializable layout descriptor for post media.
 * The renderer can use aspect ratios to pick an adaptive grid.
 */
export function buildPostMediaLayout(aspectRatios: number[]): PostMediaLayout {
  const items = (Array.isArray(aspectRatios) ? aspectRatios : []).map((ratio, index) => ({
    index,
    aspectRatio: normalizeAspectRatio(ratio),
  }));

  return {
    version: 1,
    items,
  };
}
