import { and, eq } from "drizzle-orm";
import { storyLikes } from "@shared/schema";
import { getDb } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import { touchStoryFeedBoostLike } from "../story-feed-boost/story-feed-boost";
import { getStoryLikesCount } from "../stories-count-helpers/stories-count-helpers";
import { StoriesServiceError } from "../stories-service-error/stories-service-error";
import { loadAccessibleActiveStoryRow } from "../story-viewer-access/story-viewer-access";

export async function likeStory(storyId: string, userId: string): Promise<{ likesCount: number; isLiked: true }> {
  const db = getDb();
  await cleanupExpiredStories();
  const story = await loadAccessibleActiveStoryRow(userId, storyId);
  if (story.authorId === userId) throw new StoriesServiceError(400, "Нельзя лайкнуть свой сториз");
  const inserted = await db
    .insert(storyLikes)
    .values({ storyId, userId })
    .onConflictDoNothing()
    .returning({ storyId: storyLikes.storyId });
  if (inserted.length > 0) {
    await touchStoryFeedBoostLike(storyId);
  }
  const likesCount = await getStoryLikesCount(storyId);
  return { likesCount, isLiked: true };
}

export async function unlikeStory(storyId: string, userId: string): Promise<{ likesCount: number; isLiked: false }> {
  const db = getDb();
  await cleanupExpiredStories();
  await db.delete(storyLikes).where(and(eq(storyLikes.storyId, storyId), eq(storyLikes.userId, userId)));
  const likesCount = await getStoryLikesCount(storyId);
  return { likesCount, isLiked: false };
}
