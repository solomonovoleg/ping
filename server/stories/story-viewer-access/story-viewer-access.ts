import { and, eq } from "drizzle-orm";
import { stories, storyViews, users } from "@shared/schema";
import { getDb } from "../../db";
import { cleanupExpiredStories } from "../cleanup-expired-stories/cleanup-expired-stories";
import {
  getLikesCountByStoryId,
  getLikedStoryIdSet,
  getViewsCountByStoryId,
} from "../stories-count-helpers/stories-count-helpers";
import { StoriesServiceError } from "../stories-service-error/stories-service-error";
import type { StoryRow } from "../stories-types/stories-types";
import { resolveMediaUrlForClient, shouldPresignS3MediaGetUrls } from "../../upload/s3-presign-media-urls";

type StoryAuthorRow = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: Date;
  expiresAt: Date;
  authorProfileVisibility: string | null;
  authorPublicId: number;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
};

async function fetchStoryWithAuthor(storyId: string): Promise<StoryAuthorRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      caption: stories.caption,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
      authorProfileVisibility: users.profileVisibility,
      authorPublicId: users.publicId,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(stories)
    .innerJoin(users, eq(stories.authorId, users.id))
    .where(eq(stories.id, storyId))
    .limit(1);
  return row ?? null;
}

/** Те же правила, что и лента сторис: подписка, публичный профиль, не в блоке; автор всегда видит свой контент. */
function viewerMayAccessStory(
  viewerId: string,
  row: StoryAuthorRow,
  followingIds: string[],
  blockedIds: string[],
): boolean {
  const blockedSet = new Set(blockedIds);
  if (blockedSet.has(row.authorId)) return false;
  if (row.authorId === viewerId) return true;
  const followingSet = new Set(followingIds);
  if (followingSet.has(row.authorId)) return true;
  const visibility = (row.authorProfileVisibility ?? "all").toLowerCase();
  return visibility === "all";
}

/** Неистёкшая сторис, доступная зрителю по правилам ленты (просмотр, GET по id, запись view). */
export async function loadAccessibleActiveStoryRow(viewerId: string, storyId: string): Promise<StoryAuthorRow> {
  await cleanupExpiredStories();
  const row = await fetchStoryWithAuthor(storyId);
  if (!row) throw new StoriesServiceError(404, "Сториз не найден");
  if (row.expiresAt <= new Date()) throw new StoriesServiceError(410, "Сториз уже истёк");
  const { storage } = await import("../../storage");
  if (viewerId !== row.authorId) {
    const hidden = await storage.getBlockFlags(row.authorId, viewerId);
    if (hidden?.restrictProfile) {
      throw new StoriesServiceError(404, "Сториз не найден");
    }
  }
  const followingIds = await storage.listFollowingIds(viewerId);
  const blockedIds = await storage.getBlockedRelationIds(viewerId);
  if (!viewerMayAccessStory(viewerId, row, followingIds, blockedIds)) {
    throw new StoriesServiceError(404, "Сториз не найден");
  }
  return row;
}

/** Одна активная сторис для экрана / диплинка; только неистёкшая. */
export async function getStoryByIdForViewer(viewerId: string, storyId: string): Promise<StoryRow> {
  const row = await loadAccessibleActiveStoryRow(viewerId, storyId);
  const db = getDb();
  const storyIds = [row.id];
  const viewsCountById = await getViewsCountByStoryId(storyIds);
  const likesCountById = await getLikesCountByStoryId(storyIds);
  const likedSet = await getLikedStoryIdSet(viewerId, storyIds);
  const [viewRow] = await db
    .select({ storyId: storyViews.storyId })
    .from(storyViews)
    .where(and(eq(storyViews.storyId, row.id), eq(storyViews.userId, viewerId)))
    .limit(1);
  const base: StoryRow = {
    id: row.id,
    authorId: row.authorId,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl ?? null,
    caption: row.caption ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    expiresAt: row.expiresAt?.toISOString?.() ?? String(row.expiresAt),
    viewsCount: viewsCountById.get(row.id) ?? 0,
    likesCount: likesCountById.get(row.id) ?? 0,
    isViewed: !!viewRow,
    isLiked: likedSet.has(row.id),
    author: {
      id: row.authorId,
      publicId: row.authorPublicId,
      displayName: row.authorDisplayName ?? null,
      avatarUrl: row.authorAvatarUrl ?? null,
    },
  };
  if (!shouldPresignS3MediaGetUrls()) return base;
  const [mediaUrl, thumbnailUrl, authorAvatar] = await Promise.all([
    resolveMediaUrlForClient(base.mediaUrl),
    resolveMediaUrlForClient(base.thumbnailUrl),
    resolveMediaUrlForClient(base.author?.avatarUrl ?? null),
  ]);
  return {
    ...base,
    mediaUrl: mediaUrl ?? base.mediaUrl,
    thumbnailUrl,
    author: base.author
      ? {
          ...base.author,
          avatarUrl: authorAvatar ?? base.author.avatarUrl,
        }
      : base.author,
  };
}

/**
 * Жалоба только на чужой контент, к которому у заявителя была легитимная видимость (в т.ч. недавно истёкший сторис, пока строка в БД).
 */
export async function assertStoryReportableByViewer(reporterUserId: string, storyId: string): Promise<void> {
  await cleanupExpiredStories();
  const row = await fetchStoryWithAuthor(storyId);
  if (!row) throw new StoriesServiceError(404, "Сториз не найден");
  if (row.authorId === reporterUserId) {
    throw new StoriesServiceError(400, "Нельзя пожаловаться на свой сториз");
  }
  const { storage } = await import("../../storage");
  const followingIds = await storage.listFollowingIds(reporterUserId);
  const blockedIds = await storage.getBlockedRelationIds(reporterUserId);
  if (!viewerMayAccessStory(reporterUserId, row, followingIds, blockedIds)) {
    throw new StoriesServiceError(404, "Сториз не найден");
  }
}
