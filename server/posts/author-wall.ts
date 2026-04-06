/**
 * Загрузка стены автора (посты по authorId). Используется для объединённого эндпоинта страницы профиля.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { posts, users, postComments, postReactions, postShares, postViews, savedPosts } from "@shared/schema";
import { storage } from "../storage";
import { loadLatestCommentsByPostIds } from "./load-latest-comments";
import { normalizePostMediaPublic } from "./normalize-post-media";
import { filterFeedRowsForEdgeAudience } from "./edge-display-audience";

type Row = {
  id: string;
  linkCode: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  hashtags: string[] | null;
  isDraft: boolean;
  visibility: string;
  edgeId: string | null;
  edgeDisplayAudience: string | null;
  linkEmbedEnabled: boolean;
  createdAt: Date;
  authorDisplayName: string | null;
  authorSurname: string | null;
  authorAvatarUrl: string | null;
  authorPublicId: number;
};

export type AuthorWallPost = {
  id: string;
  linkCode: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[];
  hashtags: string[];
  reactions: { emoji: string; count: number }[];
  reactionUsers: Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>;
  myReaction: string | null;
  viewsCount: number;
  sharesCount: number;
  isSaved: boolean;
  createdAt: string;
  author: { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null };
  channelName: string;
  commentsCount: number;
  latestComments: {
    id: string;
    postId: string;
    userId: string;
    text: string;
    createdAt: string;
    user: string;
    avatar: string | null;
    likes: number;
  }[];
  linkEmbedEnabled: boolean;
};

export async function getAuthorWall(
  viewerId: string,
  authorId: string,
  limit: number
): Promise<AuthorWallPost[]> {
  const db = getDb();
  const selectFields = {
    id: posts.id,
    linkCode: posts.linkCode,
    authorId: posts.authorId,
    text: posts.text,
    imageUrl: posts.imageUrl,
    mediaUrls: posts.mediaUrls,
    hashtags: posts.hashtags,
    isDraft: posts.isDraft,
    visibility: posts.visibility,
    edgeId: posts.edgeId,
    edgeDisplayAudience: posts.edgeDisplayAudience,
    linkEmbedEnabled: posts.linkEmbedEnabled,
    createdAt: posts.createdAt,
    authorDisplayName: users.displayName,
    authorSurname: users.surname,
    authorAvatarUrl: users.avatarUrl,
    authorPublicId: users.publicId,
  };
  const draftCond = authorId === viewerId ? undefined : eq(posts.isDraft, false);
  const wallCond = eq(posts.showOnAuthorWall, true);
  const whereClause = draftCond
    ? and(eq(posts.authorId, authorId), draftCond, wallCond)
    : and(eq(posts.authorId, authorId), wallCond);
  let rows = await db
    .select(selectFields)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(whereClause)
    .orderBy(desc(posts.createdAt))
    .limit(Math.min(limit, 100));

  if (authorId !== viewerId && rows.length > 0) {
    const isFollower = await storage.isFollowing(viewerId, authorId);
    if (!isFollower) {
      rows = rows.filter((r: Row) => (r.visibility ?? "public").toLowerCase() === "public");
    }
  }

  rows = await filterFeedRowsForEdgeAudience(viewerId, rows);

  const postIds = rows.map((r: Row) => r.id);
  const counts: Record<string, number> = {};
  if (postIds.length > 0) {
    const countRows = await db
      .select({ postId: postComments.postId, count: sql<number>`count(*)::int` })
      .from(postComments)
      .where(inArray(postComments.postId, postIds))
      .groupBy(postComments.postId);
    countRows.forEach((r) => { counts[r.postId] = r.count; });
  }

  const latestCommentsByPost = await loadLatestCommentsByPostIds(postIds);

  const reactionsByPost: Record<string, { emoji: string; count: number }[]> = {};
  const reactionUsersByPost: Record<string, Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>> = {};
  const myReactions: Record<string, string> = {};
  if (postIds.length > 0) {
    const reactionRows = await db
      .select({
        postId: postReactions.postId,
        emoji: postReactions.emoji,
        count: sql<number>`count(*)::int`,
      })
      .from(postReactions)
      .where(inArray(postReactions.postId, postIds))
      .groupBy(postReactions.postId, postReactions.emoji);
    reactionRows.forEach((r) => {
      if (!reactionsByPost[r.postId]) reactionsByPost[r.postId] = [];
      reactionsByPost[r.postId].push({ emoji: r.emoji, count: r.count });
    });
    const myRows = await db
      .select({ postId: postReactions.postId, emoji: postReactions.emoji })
      .from(postReactions)
      .where(and(eq(postReactions.userId, viewerId), inArray(postReactions.postId, postIds)));
    myRows.forEach((r) => { myReactions[r.postId] = r.emoji; });
    const whoReactedRows = await db
      .select({
        postId: postReactions.postId,
        emoji: postReactions.emoji,
        userId: users.id,
        displayName: users.displayName,
        surname: users.surname,
        avatarUrl: users.avatarUrl,
      })
      .from(postReactions)
      .innerJoin(users, eq(postReactions.userId, users.id))
      .where(inArray(postReactions.postId, postIds));
    whoReactedRows.forEach((r) => {
      if (!reactionUsersByPost[r.postId]) reactionUsersByPost[r.postId] = {};
      if (!reactionUsersByPost[r.postId][r.emoji]) reactionUsersByPost[r.postId][r.emoji] = [];
      reactionUsersByPost[r.postId][r.emoji].push({
        id: r.userId,
        displayName: r.displayName ?? null,
        surname: r.surname ?? null,
        avatarUrl: r.avatarUrl ?? null,
      });
    });
  }

  const viewCounts: Record<string, number> = {};
  if (postIds.length > 0) {
    const viewRows = await db
      .select({ postId: postViews.postId, count: sql<number>`count(*)::int` })
      .from(postViews)
      .where(inArray(postViews.postId, postIds))
      .groupBy(postViews.postId);
    viewRows.forEach((r) => { viewCounts[r.postId] = r.count; });
  }

  const shareCounts: Record<string, number> = {};
  if (postIds.length > 0) {
    const shareRows = await db
      .select({ postId: postShares.postId, count: sql<number>`count(*)::int` })
      .from(postShares)
      .where(inArray(postShares.postId, postIds))
      .groupBy(postShares.postId);
    shareRows.forEach((r) => { shareCounts[r.postId] = r.count; });
  }

  const savedPostIds = new Set<string>();
  if (postIds.length > 0) {
    const savedRows = await db
      .select({ postId: savedPosts.postId })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, viewerId), inArray(savedPosts.postId, postIds)));
    savedRows.forEach((r) => savedPostIds.add(r.postId));
  }

  return rows.map((r: Row) => {
    const { imageUrl: outImg, mediaUrls: urls } = normalizePostMediaPublic(r.imageUrl, r.mediaUrls);
    return {
      id: r.id,
      linkCode: r.linkCode,
      authorId: r.authorId,
      text: r.text,
      imageUrl: outImg,
      mediaUrls: urls,
      linkEmbedEnabled: r.linkEmbedEnabled !== false,
      hashtags: (r.hashtags && Array.isArray(r.hashtags)) ? r.hashtags : [],
      reactions: reactionsByPost[r.id] ?? [],
      reactionUsers: reactionUsersByPost[r.id] ?? {},
      myReaction: myReactions[r.id] ?? null,
      viewsCount: viewCounts[r.id] ?? 0,
      sharesCount: shareCounts[r.id] ?? 0,
      isSaved: savedPostIds.has(r.id),
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      author: {
        id: r.authorId,
        publicId: r.authorPublicId,
        displayName: r.authorDisplayName ?? null,
        surname: r.authorSurname ?? null,
        avatarUrl: r.authorAvatarUrl ?? null,
      },
      channelName: [r.authorDisplayName, r.authorSurname].filter(Boolean).join(" ") || `ID ${r.authorPublicId}`,
      commentsCount: counts[r.id] ?? 0,
      latestComments: latestCommentsByPost[r.id] ?? [],
    };
  });
}
