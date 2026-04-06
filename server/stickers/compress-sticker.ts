import sharp from "sharp";

const MAX_SIDE = 512;
const WEBP_QUALITY = 78;
const ALPHA_QUALITY = 85;

/**
 * Сжимает изображение стикера: до 512px по длинной стороне, WebP (прозрачность сохраняется).
 */
export async function compressStickerImageBuffer(input: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  const pipeline = sharp(input, { animated: false, limitInputPixels: 40_000_000 }).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  let resized = pipeline;
  if (w > MAX_SIDE || h > MAX_SIDE) {
    resized = resized.resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true });
  }
  const hasAlpha = meta.hasAlpha === true;
  const buf = await resized
    .webp({
      quality: WEBP_QUALITY,
      effort: 6,
      alphaQuality: hasAlpha ? ALPHA_QUALITY : undefined,
    })
    .toBuffer();
  return { buffer: buf, contentType: "image/webp" };
}
