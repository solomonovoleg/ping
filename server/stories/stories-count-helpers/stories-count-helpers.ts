import { and, eq, inArray } from "drizzle-orm";
import { storyLikes, storyViews } from "@shared/schema";
import { getDb } from "../../db";

export async function getViewsCountByStoryId(storyIds: string[]): Promise<Map<string, number>> {
  if (storyIds.length === 0) return new Map<string, number>();
  const db = getDb();
  const allViews = await db
    .select({ storyId: storyViews.storyId })
    .from(storyViews)
    .where(inArray(storyViews.storyId, storyIds));
  const map = new Map<string, number>();
  for (const row of allViews) map.set(row.storyId, (map.get(row.storyId) ?? 0) + 1);
  return map;
}

export async function getLikesCountByStoryId(storyIds: string[]): Promise<Map<string, number>> {
  if (storyIds.length === 0) return new Map<string, number>();
  const db = getDb();
  const allLikes = await db
    .select({ storyId: storyLikes.storyId })
    .from(storyLikes)
    .where(inArray(storyLikes.storyId, storyIds));
  const map = new Map<string, number>();
  for (const row of allLikes) map.set(row.storyId, (map.get(row.storyId) ?? 0) + 1);
  return map;
}

export async function getLikedStoryIdSet(userId: string, storyIds: string[]): Promise<Set<string>> {
  if (!userId || storyIds.length === 0) return new Set<string>();
  const db = getDb();
  const rows = await db
    .select({ storyId: storyLikes.storyId })
    .from(storyLikes)
    .where(and(eq(storyLikes.userId, userId), inArray(storyLikes.storyId, storyIds)));
  return new Set(rows.map((r) => r.storyId));
}

export async function getStoryLikesCount(storyId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ storyId: storyLikes.storyId })
    .from(storyLikes)
    .where(eq(storyLikes.storyId, storyId));
  return rows.length;
}
