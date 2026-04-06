import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { postComments, postReactions, postShares, postViews, savedPosts, users } from "@shared/schema";
import { loadLatestCommentsByPostIds } from "./load-latest-comments";
import type { ListPostsFeedRow } from "./list-posts-for-viewer-types";
import { normalizePostMediaPublic } from "./normalize-post-media";
import {
  postAuthorFromJoinRow,
  postChannelNameFromJoinRow,
  postEdgeDisplayAudiencePublic,
  postHashtagsPublic,
  postMediaLayoutPublic,
  postVisibilityPublic,
} from "./post-public-dto";

export async function assembleListPostsForViewer(rows: ListPostsFeedRow[], viewerId: string) {
  const db = getDb();
  const postIds = rows.map((r) => r.id);
  const counts: Record<string, number> = {};
  if (postIds.length > 0) {
    const countRows = await db
      .select({ postId: postComments.postId, count: sql<number>`count(*)::int` })
      .from(postComments)
      .where(inArray(postComments.postId, postIds))
      .groupBy(postComments.postId);
    countRows.forEach((r) => {
      counts[r.postId] = r.count;
    });
  }
  const latestCommentsByPost = await loadLatestCommentsByPostIds(postIds);
  const reactionsByPost: Record<string, { emoji: string; count: number }[]> = {};
  const reactionUsersByPost: Record<
    string,
    Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>
  > = {};
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
    myRows.forEach((r) => {
      myReactions[r.postId] = r.emoji;
    });
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
    viewRows.forEach((r) => {
      viewCounts[r.postId] = r.count;
    });
  }

  const shareCounts: Record<string, number> = {};
  if (postIds.length > 0) {
    const shareCountRows = await db
      .select({ postId: postShares.postId, count: sql<number>`count(*)::int` })
      .from(postShares)
      .where(inArray(postShares.postId, postIds))
      .groupBy(postShares.postId);
    shareCountRows.forEach((r) => {
      shareCounts[r.postId] = r.count;
    });
  }

  const savedPostIds = new Set<string>();
  if (postIds.length > 0) {
    const savedRows = await db
      .select({ postId: savedPosts.postId })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, viewerId), inArray(savedPosts.postId, postIds)));
    savedRows.forEach((r) => savedPostIds.add(r.postId));
  }

  return rows.map((r) => {
    const { imageUrl: outImg, mediaUrls: urls } = normalizePostMediaPublic(r.imageUrl, r.mediaUrls);
    return {
      id: r.id,
      linkCode: r.linkCode,
      authorId: r.authorId,
      text: r.text,
      imageUrl: outImg,
      mediaUrls: urls,
      mediaLayout: postMediaLayoutPublic(r.mediaLayout),
      hashtags: postHashtagsPublic(r.hashtags),
      edgeId: r.edgeId ?? null,
      visibility: postVisibilityPublic(r.visibility),
      edgeDisplayAudience: postEdgeDisplayAudiencePublic(r.edgeId, r.edgeDisplayAudience),
      linkEmbedEnabled: r.linkEmbedEnabled !== false,
      reactions: reactionsByPost[r.id] ?? [],
      reactionUsers: reactionUsersByPost[r.id] ?? {},
      myReaction: myReactions[r.id] ?? null,
      viewsCount: viewCounts[r.id] ?? 0,
      sharesCount: shareCounts[r.id] ?? 0,
      isSaved: savedPostIds.has(r.id),
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
      author: postAuthorFromJoinRow(r),
      channelName: postChannelNameFromJoinRow(r),
      commentsCount: counts[r.id] ?? 0,
      latestComments: latestCommentsByPost[r.id] ?? [],
    };
  });
}
