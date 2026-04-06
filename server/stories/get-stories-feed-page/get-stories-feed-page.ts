import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { stories, storyLikes, storyViews, users } from "@shared/schema";
import { getDb, ensureUserColumns, ensureStoriesFeedBoostColumns } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import { authorFeedRankMs } from "../story-feed-boost/story-feed-boost";
import type { StoriesFeedPageResult } from "../stories-types/stories-types";
import { resolveMediaUrlForClient, shouldPresignS3MediaGetUrls } from "../../upload/s3-presign-media-urls";

const DEFAULT_STORIES_FEED_AUTHOR_LIMIT = 18;

export async function getStoriesFeedPage(
  viewerId: string,
  opts?: { limit?: number; offset?: number },
): Promise<StoriesFeedPageResult> {
  await ensureUserColumns();
  await ensureStoriesFeedBoostColumns();
  await cleanupExpiredStories();
  const { storage } = await import("../../storage");
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
      caption: stories.caption,
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
        caption: s.caption ?? null,
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

  if (!shouldPresignS3MediaGetUrls()) {
    return { authors, nextOffset, hasMore };
  }
  const signedAuthors = await Promise.all(
    authors.map(async (block) => ({
      ...block,
      author: {
        ...block.author,
        avatarUrl: await resolveMediaUrlForClient(block.author.avatarUrl),
      },
      stories: await Promise.all(
        block.stories.map(async (s) => ({
          ...s,
          mediaUrl: (await resolveMediaUrlForClient(s.mediaUrl)) ?? s.mediaUrl,
          thumbnailUrl: await resolveMediaUrlForClient(s.thumbnailUrl),
        })),
      ),
    })),
  );
  return { authors: signedAuthors, nextOffset, hasMore };
}
