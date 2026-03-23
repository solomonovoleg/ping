import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb, ensureUserColumns, ensureStoriesFeedBoostColumns } from "../db";
import { stories, users, storyViews, storyLikes } from "@shared/schema";

const STORY_DEFAULT_EXPIRES_HOURS = 24;
const STORY_ALLOWED_EXPIRES_HOURS = [24, 46, 56] as const;

/** Буст от лайка — короче (меньше «веса» в ленте). */
export const STORY_FEED_LIKE_BOOST_MS = 5 * 60 * 1000;
/** Буст от ответа на сториз в чате — дольше и сильнее влияет на порядок. */
export const STORY_FEED_REPLY_BOOST_MS = 15 * 60 * 1000;

const DEFAULT_STORIES_FEED_AUTHOR_LIMIT = 18;

type StoryFeedRow = {
  createdAt: Date;
  feedBoostLikeAt: Date | null;
  feedBoostReplyAt: Date | null;
};

function authorFeedRankMs(authorStories: StoryFeedRow[], nowMs: number): number {
  let latestCreated = 0;
  let bestLikeBoost = 0;
  let bestReplyBoost = 0;
  for (const s of authorStories) {
    const c = s.createdAt?.getTime?.() ?? 0;
    if (c > latestCreated) latestCreated = c;
    const lk = s.feedBoostLikeAt?.getTime?.() ?? 0;
    if (lk > 0 && nowMs < lk + STORY_FEED_LIKE_BOOST_MS && lk > bestLikeBoost) bestLikeBoost = lk;
    const rp = s.feedBoostReplyAt?.getTime?.() ?? 0;
    if (rp > 0 && nowMs < rp + STORY_FEED_REPLY_BOOST_MS && rp > bestReplyBoost) bestReplyBoost = rp;
  }
  return Math.max(latestCreated, bestLikeBoost, bestReplyBoost);
}

/** Новый лайк (не дубль). */
export async function touchStoryFeedBoostLike(storyId: string): Promise<void> {
  await ensureStoriesFeedBoostColumns();
  const db = getDb();
  const now = new Date();
  await db
    .update(stories)
    .set({ feedBoostLikeAt: now })
    .where(and(eq(stories.id, storyId), gt(stories.expiresAt, now)));
}

/** Ответ на сториз в личке. */
export async function touchStoryFeedBoostReply(storyId: string): Promise<void> {
  await ensureStoriesFeedBoostColumns();
  const db = getDb();
  const now = new Date();
  await db
    .update(stories)
    .set({ feedBoostReplyAt: now })
    .where(and(eq(stories.id, storyId), gt(stories.expiresAt, now)));
}

export type StoriesFeedPageResult = {
  authors: {
    authorId: string;
    author: { id: string; publicId: number; displayName: string | null; avatarUrl: string | null };
    latestStoryAt: string | null;
    hasUnseen: boolean;
    unseenCount: number;
    stories: {
      id: string;
      authorId: string;
      mediaUrl: string;
      thumbnailUrl: string | null;
      createdAt: string;
      expiresAt: string;
      viewsCount: number;
      likesCount: number;
      isViewed: boolean;
      isLiked: boolean;
    }[];
  }[];
  nextOffset: number;
  hasMore: boolean;
};

export type StoryRow = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  expiresAt: string;
  viewsCount?: number;
  likesCount?: number;
  isLiked?: boolean;
};

export class StoriesServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Сториз по authorId (для объединённого эндпоинта страницы профиля). */
export async function getStoriesByAuthorId(authorId: string, viewerId?: string): Promise<StoryRow[]> {
  const db = getDb();
  await cleanupExpiredStories();
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
  const storyIds = rows.map((r) => r.id);
  const viewsCountById = await getViewsCountByStoryId(storyIds);
  const likesCountById = await getLikesCountByStoryId(storyIds);
  const likedStoryIdSet = viewerId ? await getLikedStoryIdSet(viewerId, storyIds) : new Set<string>();
  return rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    mediaUrl: r.mediaUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    expiresAt: r.expiresAt?.toISOString?.() ?? String(r.expiresAt),
    viewsCount: viewsCountById.get(r.id) ?? 0,
    likesCount: likesCountById.get(r.id) ?? 0,
    isLiked: likedStoryIdSet.has(r.id),
  }));
}

export async function listStoriesByUserIdOrPublicId(userIdParam: string, viewerId?: string): Promise<StoryRow[]> {
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
  return getStoriesByAuthorId(authorId, viewerId);
}

export async function createStory(
  authorId: string,
  mediaUrl: string,
  thumbnailUrl: string | null,
  expiresInHours?: number | string,
) {
  await cleanupExpiredStories();
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
  await cleanupExpiredStories();
  const [story] = await db
    .select({ authorId: stories.authorId, expiresAt: stories.expiresAt })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);
  if (!story) throw new StoriesServiceError(404, "Сториз не найден");
  if (story.expiresAt <= new Date()) throw new StoriesServiceError(410, "Сториз уже истёк");
  if (story.authorId === viewerId) return;
  await db.insert(storyViews).values({ storyId, userId: viewerId }).onConflictDoNothing();
}

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

export async function getStoriesFeedPage(
  viewerId: string,
  opts?: { limit?: number; offset?: number },
): Promise<StoriesFeedPageResult> {
  await ensureUserColumns();
  await ensureStoriesFeedBoostColumns();
  await cleanupExpiredStories();
  const { storage } = await import("../storage");
  const followingIds = await storage.listFollowingIds(viewerId);
  const blockedRelationIds = await storage.getBlockedRelationIds(viewerId);
  const db = getDb();
  const now = new Date();
  const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_STORIES_FEED_AUTHOR_LIMIT, 1), 40);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const rows = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
      feedBoostLikeAt: stories.feedBoostLikeAt,
      feedBoostReplyAt: stories.feedBoostReplyAt,
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
  const likesCountByStoryId = new Map<string, number>();
  const viewedStoryIdSet = new Set<string>();
  const likedStoryIdSet = new Set<string>();

  if (visibleStoryIds.length > 0) {
    const allViews = await db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(inArray(storyViews.storyId, visibleStoryIds));
    for (const row of allViews) {
      viewsCountByStoryId.set(row.storyId, (viewsCountByStoryId.get(row.storyId) ?? 0) + 1);
    }
    const allLikes = await db
      .select({ storyId: storyLikes.storyId })
      .from(storyLikes)
      .where(inArray(storyLikes.storyId, visibleStoryIds));
    for (const row of allLikes) {
      likesCountByStoryId.set(row.storyId, (likesCountByStoryId.get(row.storyId) ?? 0) + 1);
    }
    const viewedByMe = await db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(and(eq(storyViews.userId, viewerId), inArray(storyViews.storyId, visibleStoryIds)));
    for (const row of viewedByMe) viewedStoryIdSet.add(row.storyId);
    const likedByMe = await db
      .select({ storyId: storyLikes.storyId })
      .from(storyLikes)
      .where(and(eq(storyLikes.userId, viewerId), inArray(storyLikes.storyId, visibleStoryIds)));
    for (const row of likedByMe) likedStoryIdSet.add(row.storyId);
  }

  const nowMs = Date.now();
  type RowSort = StoriesFeedPageResult["authors"][number] & {
    feedRankMs: number;
    seenBucket: number;
  };

  const withRank: RowSort[] = Array.from(byAuthor.entries()).map(([authorId, data]) => {
    const authorStories = data.stories;
    const latestCreatedAt = authorStories[0]?.createdAt?.getTime?.() ?? 0;
    const feedRankMs = authorFeedRankMs(authorStories, nowMs);
    const storyPayload = authorStories.map((s) => {
      const createdAtIso = s.createdAt?.toISOString?.() ?? String(s.createdAt);
      const expiresAtIso = s.expiresAt?.toISOString?.() ?? String(s.expiresAt);
      const viewsCount = viewsCountByStoryId.get(s.id) ?? 0;
      const likesCount = likesCountByStoryId.get(s.id) ?? 0;
      const isViewed = viewedStoryIdSet.has(s.id);
      const isLiked = likedStoryIdSet.has(s.id);
      return {
        id: s.id,
        authorId: s.authorId,
        mediaUrl: s.mediaUrl,
        thumbnailUrl: s.thumbnailUrl ?? null,
        createdAt: createdAtIso,
        expiresAt: expiresAtIso,
        viewsCount,
        likesCount,
        isViewed,
        isLiked,
      };
    });
    const unseenCount = authorId === viewerId ? 0 : storyPayload.filter((s) => !s.isViewed).length;
    const hasUnseen = unseenCount > 0;
    /** 0: «я» или есть непросмотренные чужие; 1: чужой аккаунт и всё просмотрено — в конец. */
    const seenBucket = authorId === viewerId ? 0 : hasUnseen ? 0 : 1;
    return {
      authorId,
      author: data.author,
      latestStoryAt: latestCreatedAt > 0 ? new Date(latestCreatedAt).toISOString() : null,
      hasUnseen,
      unseenCount,
      stories: storyPayload,
      feedRankMs,
      seenBucket,
    };
  });

  withRank.sort((a, b) => {
    if (a.seenBucket !== b.seenBucket) return a.seenBucket - b.seenBucket;
    if (a.seenBucket === 0 && b.seenBucket === 0) {
      const aSelf = a.authorId === viewerId ? 0 : 1;
      const bSelf = b.authorId === viewerId ? 0 : 1;
      if (aSelf !== bSelf) return aSelf - bSelf;
    }
    if (b.feedRankMs !== a.feedRankMs) return b.feedRankMs - a.feedRankMs;
    if (b.unseenCount !== a.unseenCount) return b.unseenCount - a.unseenCount;
    return a.authorId.localeCompare(b.authorId);
  });

  const total = withRank.length;
  const slice = withRank.slice(offset, offset + limit);
  const authors = slice.map(({ feedRankMs: _fr, seenBucket: _sb, ...rest }) => rest);
  const nextOffset = offset + authors.length;
  const hasMore = nextOffset < total;

  return { authors, nextOffset, hasMore };
}

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
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    expiresAt: r.expiresAt?.toISOString?.() ?? String(r.expiresAt),
    viewsCount: viewsCountById.get(r.id) ?? 0,
    likesCount: likesCountById.get(r.id) ?? 0,
    isLiked: false,
  }));
}

export async function likeStory(storyId: string, userId: string): Promise<{ likesCount: number; isLiked: true }> {
  const db = getDb();
  await cleanupExpiredStories();
  const [story] = await db
    .select({ id: stories.id, authorId: stories.authorId, expiresAt: stories.expiresAt })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);
  if (!story) throw new StoriesServiceError(404, "Сториз не найден");
  if (story.expiresAt <= new Date()) throw new StoriesServiceError(410, "Сториз уже истёк");
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

async function getViewsCountByStoryId(storyIds: string[]): Promise<Map<string, number>> {
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

async function getLikesCountByStoryId(storyIds: string[]): Promise<Map<string, number>> {
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

async function getLikedStoryIdSet(userId: string, storyIds: string[]): Promise<Set<string>> {
  if (!userId || storyIds.length === 0) return new Set<string>();
  const db = getDb();
  const rows = await db
    .select({ storyId: storyLikes.storyId })
    .from(storyLikes)
    .where(and(eq(storyLikes.userId, userId), inArray(storyLikes.storyId, storyIds)));
  return new Set(rows.map((r) => r.storyId));
}

async function getStoryLikesCount(storyId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ storyId: storyLikes.storyId })
    .from(storyLikes)
    .where(eq(storyLikes.storyId, storyId));
  return rows.length;
}

export async function cleanupExpiredStories(): Promise<number> {
  const db = getDb();
  // Держим архив просроченных сториз 30 дней, затем удаляем.
  const now = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(stories)
    .where(lt(stories.expiresAt, now))
    .returning({ id: stories.id });
  return deleted.length;
}
