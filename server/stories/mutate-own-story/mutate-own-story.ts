import { and, desc, eq, lt } from "drizzle-orm";
import { stories } from "@shared/schema";
import { getDb } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import {
  getLikesCountByStoryId,
  getViewsCountByStoryId,
} from "../stories-count-helpers/stories-count-helpers";
import { StoriesServiceError } from "../stories-service-error/stories-service-error";
import type { StoryRow } from "../stories-types/stories-types";

export async function deleteOwnStory(storyId: string, userId: string): Promise<void> {
  await cleanupExpiredStories();
  const db = getDb();
  const deleted = await db
    .delete(stories)
    .where(and(eq(stories.id, storyId), eq(stories.authorId, userId)))
    .returning({ id: stories.id });
  if (!deleted.length) throw new StoriesServiceError(404, "Сториз не найден или нет прав");
}

export async function archiveOwnStory(storyId: string, userId: string): Promise<void> {
  await cleanupExpiredStories();
  const db = getDb();
  const updated = await db
    .update(stories)
    .set({ expiresAt: new Date() })
    .where(and(eq(stories.id, storyId), eq(stories.authorId, userId)))
    .returning({ id: stories.id });
  if (!updated.length) throw new StoriesServiceError(404, "Сториз не найден или нет прав");
}

export async function listArchivedStories(authorId: string): Promise<StoryRow[]> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      caption: stories.caption,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
    })
    .from(stories)
    .where(and(eq(stories.authorId, authorId), lt(stories.expiresAt, now)))
    .orderBy(desc(stories.createdAt))
    .limit(200);
  const storyIds = rows.map((r) => r.id);
  const viewsCountById = await getViewsCountByStoryId(storyIds);
  const likesCountById = await getLikesCountByStoryId(storyIds);
  return rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    caption: r.caption ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    expiresAt: r.expiresAt?.toISOString?.() ?? String(r.expiresAt),
    viewsCount: viewsCountById.get(r.id) ?? 0,
    likesCount: likesCountById.get(r.id) ?? 0,
    isLiked: false,
  }));
}
