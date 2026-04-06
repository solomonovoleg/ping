import { sql } from "drizzle-orm";
import { posts } from "@shared/schema";

/**
 * Условие «в посте есть загруженное видео» (URL с .mp4 / .webm / .mov).
 * Согласовано с клиентом `client/src/lib/feed-video-post.ts`.
 */
export function sqlPostHasUploadedVideo() {
  return sql`(
    (${posts.imageUrl} IS NOT NULL AND ${posts.imageUrl} ~* '\\.(mp4|webm|mov)(\\?|$)')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(coalesce(${posts.mediaUrls}, '[]'::jsonb)) AS reel_media(u)
      WHERE reel_media.u ~* '\\.(mp4|webm|mov)(\\?|$)'
    )
  )`;
}
