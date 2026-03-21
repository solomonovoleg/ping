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
