import { formatPostTime, type FeedPost } from "@/lib/posts";
import { resolveUrl } from "@/lib/api-base";

export function firstPostMediaUrl(post: FeedPost): string {
  const urls = post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
  const u = urls[0];
  return u ? resolveUrl(u) : "";
}

export function isVideoMediaUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url);
}

/** Строка под заголовком поста в макете PULSE: «Видео · 2 дн» без «назад». */
export function pulseProfilePostMeta(post: FeedPost): string {
  const url = firstPostMediaUrl(post);
  const video = url ? isVideoMediaUrl(url) : false;
  const photo = url && !video;
  const t = formatPostTime(post.createdAt).replace(/\s*назад\s*$/i, "").trim();
  if (video) return `Видео · ${t}`;
  if (photo) return `Фото · ${t}`;
  return t;
}

/** Две строки шапки как в референсе: рядом с именем — тип; ниже — время. */
export function pulseProfilePostMetaParts(post: FeedPost): { kind: string | null; timeShort: string } {
  const url = firstPostMediaUrl(post);
  const video = url ? isVideoMediaUrl(url) : false;
  const photo = url && !video;
  const timeShort = formatPostTime(post.createdAt).replace(/\s*назад\s*$/i, "").trim();
  const kind = video ? "Видео" : photo ? "Фото" : null;
  return { kind, timeShort };
}

export function formatProfilePostMetric(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}
