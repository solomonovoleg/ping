/**
 * После транскода постового/аватарного видео на сервере рядом кладётся JPEG (тот же путь, расширение `.jpg`).
 * См. `process-post-media-s3.ts`, `transcodeStoryVideoFileToPath`.
 * Передавайте уже `resolveUrl(...)` если URL относительный.
 */
export function avatarVideoPosterUrl(resolvedVideoUrl: string): string | undefined {
  const trimmed = resolvedVideoUrl.trim();
  if (!trimmed) return undefined;
  const m = trimmed.match(/^(.+)\.(mp4|webm|mov|m4v)(\?[^#]*)?(#.*)?$/i);
  if (!m) return undefined;
  const [, base, , query = "", hash = ""] = m;
  return `${base}.jpg${query}${hash}`;
}
