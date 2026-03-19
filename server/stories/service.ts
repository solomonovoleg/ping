import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stories, users, storyViews } from "@shared/schema";

const STORY_DEFAULT_EXPIRES_HOURS = 24;
const STORY_ALLOWED_EXPIRES_HOURS = [24, 46, 56] as const;

export type StoryRow = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  expiresAt: string;
};

export class StoriesServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Сториз по authorId (для объединённого эндпоинта страницы профиля). */
export async function getStoriesByAuthorId(authorId: string): Promise<StoryRow[]> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
    })
    .from(stories)
    .where(and(eq(stories.authorId, authorId), gt(stories.expiresAt, now)))
    .orderBy(desc(stories.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    expiresAt: r.expiresAt?.toISOString?.() ?? String(r.expiresAt),
  }));
}

export async function listStoriesByUserIdOrPublicId(userIdParam: string): Promise<StoryRow[]> {
  const db = getDb();
  let authorId: string | null = null;
  if (/^\d+$/.test(userIdParam)) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.publicId, parseInt(userIdParam, 10)))
      .limit(1);
    authorId = u?.id ?? null;
  } else {
    authorId = userIdParam;
  }
  if (!authorId) return [];
  return getStoriesByAuthorId(authorId);
}

export async function createStory(
  authorId: string,
  mediaUrl: string,
  thumbnailUrl: string | null,
  expiresInHours?: number | string,
) {
  const requestedHours =
    typeof expiresInHours === "number"
      ? Math.trunc(expiresInHours)
      : typeof expiresInHours === "string"
        ? Number.parseInt(expiresInHours, 10)
        : STORY_DEFAULT_EXPIRES_HOURS;
  const validHours = STORY_ALLOWED_EXPIRES_HOURS.includes(requestedHours as 24 | 46 | 56)
    ? (requestedHours as 24 | 46 | 56)
    : STORY_DEFAULT_EXPIRES_HOURS;
  const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000);
  const db = getDb();
  const [inserted] = await db
    .insert(stories)
    .values({
      authorId,
      mediaUrl,
      thumbnailUrl,
      expiresAt,
    })
    .returning();
  if (!inserted) throw new StoriesServiceError(500, "Не удалось создать сториз");
  return {
    id: inserted.id,
    authorId: inserted.authorId,
    mediaUrl: inserted.mediaUrl,
    thumbnailUrl: inserted.thumbnailUrl ?? null,
    createdAt: inserted.createdAt?.toISOString?.() ?? inserted.createdAt,
    expiresAt: inserted.expiresAt?.toISOString?.() ?? inserted.expiresAt,
    expiresInHours: validHours,
  };
}

export async function recordStoryView(storyId: string, viewerId: string): Promise<void> {
  const db = getDb();
  const [story] = await db
    .select({ authorId: stories.authorId })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);
  if (!story) throw new StoriesServiceError(404, "Сториз не найден");
  await db.insert(storyViews).values({ storyId, userId: viewerId }).onConflictDoNothing();
}

export async function listStoryViewers(storyId: string, requesterId: string) {
  const db = getDb();
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

export async function getStoriesFeed(viewerId: string) {
  const { storage } = await import("../storage");
  const followingIds = await storage.listFollowingIds(viewerId);
  const blockedRelationIds = await storage.getBlockedRelationIds(viewerId);
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
      authorPublicId: users.publicId,
      authorProfileVisibility: users.profileVisibility,
    })
    .from(stories)
    .innerJoin(users, eq(stories.authorId, users.id))
    .where(gt(stories.expiresAt, now))
    .orderBy(desc(stories.createdAt));
  const followingSet = new Set(followingIds);
  const blockedSet = new Set(blockedRelationIds);
  const visibleRows = rows.filter((r) => {
    if (blockedSet.has(r.authorId)) return false;
    if (r.authorId === viewerId) return true;
    if (followingSet.has(r.authorId)) return true;
    const visibility = (r.authorProfileVisibility ?? "all").toLowerCase();
    return visibility === "all";
  });
  const byAuthor = new Map<
    string,
    { author: { id: string; publicId: number; displayName: string | null; avatarUrl: string | null }; stories: typeof rows }
  >();
  for (const r of visibleRows) {
    const id = r.authorId;
    if (!byAuthor.has(id)) {
      byAuthor.set(id, {
        author: {
          id,
          publicId: r.authorPublicId,
          displayName: r.authorDisplayName ?? null,
          avatarUrl: r.authorAvatarUrl ?? null,
        },
        stories: [],
      });
    }
    byAuthor.get(id)!.stories.push(r);
  }
  const visibleStoryIds = visibleRows.map((r) => r.id);
  const viewsCountByStoryId = new Map<string, number>();
  const viewedStoryIdSet = new Set<string>();

  if (visibleStoryIds.length > 0) {
    const allViews = await db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(inArray(storyViews.storyId, visibleStoryIds));
    for (const row of allViews) {
      viewsCountByStoryId.set(row.storyId, (viewsCountByStoryId.get(row.storyId) ?? 0) + 1);
    }
    const viewedByMe = await db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(and(eq(storyViews.userId, viewerId), inArray(storyViews.storyId, visibleStoryIds)));
    for (const row of viewedByMe) viewedStoryIdSet.add(row.storyId);
  }

  return Array.from(byAuthor.entries())
    .map(([authorId, data]) => {
      const authorStories = data.stories;
      const latestCreatedAt = authorStories[0]?.createdAt?.getTime?.() ?? 0;
      const storyPayload = authorStories.map((s) => {
        const createdAtIso = s.createdAt?.toISOString?.() ?? String(s.createdAt);
        const expiresAtIso = s.expiresAt?.toISOString?.() ?? String(s.expiresAt);
        const viewsCount = viewsCountByStoryId.get(s.id) ?? 0;
        const isViewed = viewedStoryIdSet.has(s.id);
        return {
          id: s.id,
          authorId: s.authorId,
          mediaUrl: s.mediaUrl,
          thumbnailUrl: s.thumbnailUrl ?? null,
          createdAt: createdAtIso,
          expiresAt: expiresAtIso,
          viewsCount,
          isViewed,
        };
      });
      const unseenCount = authorId === viewerId ? 0 : storyPayload.filter((s) => !s.isViewed).length;
      const totalViews = storyPayload.reduce((sum, s) => sum + s.viewsCount, 0);
      const activityScore = totalViews * 2 + storyPayload.length;
      return {
        authorId,
        author: data.author,
        latestStoryAt: latestCreatedAt > 0 ? new Date(latestCreatedAt).toISOString() : null,
        hasUnseen: unseenCount > 0,
        unseenCount,
        activityScore,
        stories: storyPayload,
      };
    })
    .sort((a, b) => {
      const byTime =
        Date.parse(b.latestStoryAt ?? "1970-01-01T00:00:00.000Z") -
        Date.parse(a.latestStoryAt ?? "1970-01-01T00:00:00.000Z");
      if (byTime !== 0) return byTime;
      if (b.activityScore !== a.activityScore) return b.activityScore - a.activityScore;
      return b.unseenCount - a.unseenCount;
    });
}

export async function deleteOwnStory(storyId: string, userId: string): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(stories)
    .where(and(eq(stories.id, storyId), eq(stories.authorId, userId)))
    .returning({ id: stories.id });
  if (!deleted.length) throw new StoriesServiceError(404, "Сториз не найден или нет прав");
}
