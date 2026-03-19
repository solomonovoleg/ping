export type SingleImageFormat = "square" | "story" | "horizontal";

export type PostMediaLayout =
  | { mode: "single"; count: 1; format: SingleImageFormat }
  | { mode: "collage"; count: number; variant: "grid_2" | "mosaic_3" | "grid_4" | "grid_5_plus" };

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function pickSingleImageFormat(aspectRatio: number): SingleImageFormat {
  if (!isFinitePositive(aspectRatio)) return "square";
  if (aspectRatio >= 1.2) return "horizontal";
  if (aspectRatio <= 0.78) return "story";
  return "square";
}

export function buildPostMediaLayout(aspectRatios: number[]): PostMediaLayout | null {
  const count = aspectRatios.length;
  if (count <= 0) return null;
  if (count === 1) {
    return { mode: "single", count: 1, format: pickSingleImageFormat(aspectRatios[0] ?? 1) };
  }
  if (count === 2) return { mode: "collage", count, variant: "grid_2" };
  if (count === 3) return { mode: "collage", count, variant: "mosaic_3" };
  if (count === 4) return { mode: "collage", count, variant: "grid_4" };
  return { mode: "collage", count, variant: "grid_5_plus" };
}

export function isPostMediaLayout(value: unknown): value is PostMediaLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.mode === "single") {
    return v.count === 1 && (v.format === "square" || v.format === "story" || v.format === "horizontal");
  }
  if (v.mode === "collage") {
    const validVariant = v.variant === "grid_2" || v.variant === "mosaic_3" || v.variant === "grid_4" || v.variant === "grid_5_plus";
    return validVariant && typeof v.count === "number" && v.count >= 2 && v.count <= 10;
  }
  return false;
}
