/**
 * Единый путь к ffmpeg: на VPS server-setup.sh может записать FFMPEG_PATH на статическую сборку с libheif.
 */
export function getFfmpegExecutable(): string {
  const p = process.env.FFMPEG_PATH?.trim() || process.env.FFMPEG_BIN?.trim();
  return p || "ffmpeg";
}
