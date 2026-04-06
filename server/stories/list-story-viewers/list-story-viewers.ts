import { desc, eq } from "drizzle-orm";
import { stories, storyViews, users } from "@shared/schema";
import { getDb } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import { StoriesServiceError } from "../stories-service-error/stories-service-error";

export async function listStoryViewers(storyId: string, requesterId: string) {
  const db = getDb();
  await cleanupExpiredStories();
  const [story] = await db
    .select({ id: stories.id, authorId: stories.authorId })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);
  if (!story) throw new StoriesServiceError(404, "Сториз не найден");
  if (story.authorId !== requesterId) throw new StoriesServiceError(403, "Нет доступа");
  const rows = await db
    .select({
      id: users.id,
      publicId: users.publicId,
      displayName: users.displayName,
      surname: users.surname,
      avatarUrl: users.avatarUrl,
      viewedAt: storyViews.viewedAt,
    })
    .from(storyViews)
    .innerJoin(users, eq(storyViews.userId, users.id))
    .where(eq(storyViews.storyId, storyId))
    .orderBy(desc(storyViews.viewedAt));
  return rows.map((r) => ({
    id: r.id,
    publicId: r.publicId,
    displayName: r.displayName ?? null,
    surname: r.surname ?? null,
    avatarUrl: r.avatarUrl ?? null,
    viewedAt: r.viewedAt?.toISOString?.() ?? String(r.viewedAt),
  }));
}
