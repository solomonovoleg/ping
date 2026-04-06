import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stories, storyViews } from "@shared/schema";

export async function getStoryStatusByAuthor(
  viewerId: string,
  authorIds: string[],
): Promise<Map<string, { hasActiveStory: boolean; hasUnseenStory: boolean }>> {
  const map = new Map<string, { hasActiveStory: boolean; hasUnseenStory: boolean }>();
  if (authorIds.length === 0) return map;

  const uniqueAuthorIds = Array.from(new Set(authorIds.filter(Boolean)));
  if (uniqueAuthorIds.length === 0) return map;

  const db = getDb();
  const now = new Date();
  const activeStories = await db
    .select({ id: stories.id, authorId: stories.authorId })
    .from(stories)
    .where(and(inArray(stories.authorId, uniqueAuthorIds), gt(stories.expiresAt, now)));

  if (activeStories.length === 0) {
    uniqueAuthorIds.forEach((id) => map.set(id, { hasActiveStory: false, hasUnseenStory: false }));
    return map;
  }

  const storyIds = activeStories.map((s) => s.id);
  const viewedRows = await db
    .select({ storyId: storyViews.storyId })
    .from(storyViews)
    .where(and(eq(storyViews.userId, viewerId), inArray(storyViews.storyId, storyIds)));
  const viewedSet = new Set(viewedRows.map((v) => v.storyId));

  const byAuthor = new Map<string, { hasActiveStory: boolean; hasUnseenStory: boolean }>();
  for (const story of activeStories) {
    const prev = byAuthor.get(story.authorId) ?? { hasActiveStory: false, hasUnseenStory: false };
    byAuthor.set(story.authorId, {
      hasActiveStory: true,
      hasUnseenStory: prev.hasUnseenStory || !viewedSet.has(story.id),
    });
  }
  uniqueAuthorIds.forEach((id) => map.set(id, byAuthor.get(id) ?? { hasActiveStory: false, hasUnseenStory: false }));
  return map;
}
