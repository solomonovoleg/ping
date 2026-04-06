import type { FeedPost } from "@/lib/posts";
import { avatarVideoPosterUrl } from "@/lib/avatar-video-poster";

/** Визуальные URL поста (без чистого аудио как отдельного «видео»). */
export function collectFeedPostVisualMediaUrls(post: FeedPost): string[] {
  const raw = post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
  return raw.filter((u) => !/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(u));
}

export function isUploadedVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url);
}

/** Загруженное видео в медиа поста (не embed-only в тексте). */
export function postHasUploadedVideo(post: FeedPost): boolean {
  return collectFeedPostVisualMediaUrls(post).some(isUploadedVideoMediaUrl);
}

export function getPrimaryVideoUrlForPost(post: FeedPost): string | null {
  const urls = collectFeedPostVisualMediaUrls(post).filter(isUploadedVideoMediaUrl);
  return urls[0] ?? null;
}

/**
 * Обложка до первого кадра видео (карусель: первое не-видео; иначе `imageUrl`, если это не файл видео).
 * Как в Instagram Reels: сразу картинка, без чёрного кадра.
 */
export function getReelPosterUrlForPost(post: FeedPost): string | null {
  const urls = collectFeedPostVisualMediaUrls(post);
  const fromCarousel = urls.find((u) => !isUploadedVideoMediaUrl(u));
  if (fromCarousel) return fromCarousel;
  const iu = post.imageUrl?.trim() ?? "";
  if (iu && !isUploadedVideoMediaUrl(iu)) return iu;
  const video = getPrimaryVideoUrlForPost(post);
  if (video) {
    const sibling = avatarVideoPosterUrl(video.trim());
    if (sibling) return sibling;
  }
  return null;
}
