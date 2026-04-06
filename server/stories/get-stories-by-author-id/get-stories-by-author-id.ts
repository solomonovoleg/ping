import { and, desc, eq, gt } from "drizzle-orm";
import { stories, users } from "@shared/schema";
import { getDb } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import {
  getLikesCountByStoryId,
  getLikedStoryIdSet,
  getViewsCountByStoryId,
} from "../stories-count-helpers/stories-count-helpers";
import type { StoryRow } from "../stories-types/stories-types";
import { resolveMediaUrlForClient, shouldPresignS3MediaGetUrls } from "../../upload/s3-presign-media-urls";

/** Сториз по authorId (для объединённого эндпоинта страницы профиля). */
export async function getStoriesByAuthorId(authorId: string, viewerId?: string): Promise<StoryRow[]> {
  const db = getDb();
  await cleanupExpiredStories();
  if (viewerId && viewerId !== authorId) {
    const { storage } = await import("../../storage");
    const profileHidden = await storage.getBlockFlags(authorId, viewerId);
    if (profileHidden?.restrictProfile) return [];

    const [author] = await db
      .select({ id: users.id, profileVisibility: users.profileVisibility })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);
    if (!author) return [];
    const [followingIds, blockedIds] = await Promise.all([
      storage.listFollowingIds(viewerId),
      storage.getBlockedRelationIds(viewerId),
    ]);
    const blockedSet = new Set(blockedIds);
    if (blockedSet.has(authorId)) return [];
    const isFollowing = new Set(followingIds).has(authorId);
    const visibility = (author.profileVisibility ?? "all").toLowerCase();
    if (!isFollowing && visibility !== "all") return [];
  }
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
    .where(and(eq(stories.authorId, authorId), gt(stories.expiresAt, now)))
    .orderBy(desc(stories.createdAt))
    .limit(50);
  const storyIds = rows.map((r) => r.id);
  const viewsCountById = await getViewsCountByStoryId(storyIds);
  const likesCountById = await getLikesCountByStoryId(storyIds);
  const likedStoryIdSet = viewerId ? await getLikedStoryIdSet(viewerId, storyIds) : new Set<string>();
  const mapped: StoryRow[] = rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    caption: r.caption ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    expiresAt: r.expiresAt?.toISOString?.() ?? String(r.expiresAt),
    viewsCount: viewsCountById.get(r.id) ?? 0,
    likesCount: likesCountById.get(r.id) ?? 0,
    isLiked: likedStoryIdSet.has(r.id),
  }));
  if (!shouldPresignS3MediaGetUrls()) return mapped;
  return Promise.all(
    mapped.map(async (row) => ({
      ...row,
      mediaUrl: (await resolveMediaUrlForClient(row.mediaUrl)) ?? row.mediaUrl,
      thumbnailUrl: await resolveMediaUrlForClient(row.thumbnailUrl),
    })),
  );
}
