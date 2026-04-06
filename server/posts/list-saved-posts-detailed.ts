import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { postComments, postReactions, postViews, posts, savedPosts, users } from "@shared/schema";
import { loadLatestCommentsByPostIds } from "./load-latest-comments";
import { normalizePostMediaPublic } from "./normalize-post-media";
import {
  postAuthorFromJoinRow,
  postChannelNameFromJoinRow,
  postEdgeDisplayAudiencePublic,
  postHashtagsPublic,
  postMediaLayoutPublic,
  postVisibilityPublic,
} from "./post-public-dto";

export async function listSavedPostsDetailed(userId: string, limit: number, offset: number) {
  const db = getDb();
  const saved = await db
    .select({ postId: savedPosts.postId, savedAt: savedPosts.savedAt })
    .from(savedPosts)
    .where(eq(savedPosts.userId, userId))
    .orderBy(desc(savedPosts.savedAt))
    .limit(limit)
    .offset(offset);
  const postIds = saved.map((s) => s.postId);
  if (postIds.length === 0) return [];

  const rows = await db
    .select({
      id: posts.id,
      linkCode: posts.linkCode,
      authorId: posts.authorId,
      text: posts.text,
      imageUrl: posts.imageUrl,
      mediaUrls: posts.mediaUrls,
      mediaLayout: posts.mediaLayout,
      hashtags: posts.hashtags,
      visibility: posts.visibility,
      edgeId: posts.edgeId,
      edgeDisplayAudience: posts.edgeDisplayAudience,
      linkEmbedEnabled: posts.linkEmbedEnabled,
      createdAt: posts.createdAt,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
      authorPublicId: users.publicId,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(inArray(posts.id, postIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = postIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
  const postIdsForCounts = ordered.map((r) => r.id);
  const counts: Record<string, number> = {};
  const countRows = await db
    .select({ postId: postComments.postId, count: sql<number>`count(*)::int` })
    .from(postComments)
    .where(inArray(postComments.postId, postIdsForCounts))
    .groupBy(postComments.postId);
  countRows.forEach((r) => {
    counts[r.postId] = r.count;
  });
  const latestCommentsByPost = await loadLatestCommentsByPostIds(postIdsForCounts);
  const reactionRows = await db
    .select({ postId: postReactions.postId, emoji: postReactions.emoji, count: sql<number>`count(*)::int` })
    .from(postReactions)
    .where(inArray(postReactions.postId, postIdsForCounts))
    .groupBy(postReactions.postId, postReactions.emoji);
  const reactionsByPost: Record<string, { emoji: string; count: number }[]> = {};
  reactionRows.forEach((r) => {
    if (!reactionsByPost[r.postId]) reactionsByPost[r.postId] = [];
    reactionsByPost[r.postId].push({ emoji: r.emoji, count: r.count });
  });
  const viewRows = await db
    .select({ postId: postViews.postId, count: sql<number>`count(*)::int` })
    .from(postViews)
    .where(inArray(postViews.postId, postIdsForCounts))
    .groupBy(postViews.postId);
  const viewCounts: Record<string, number> = {};
  viewRows.forEach((r) => {
    viewCounts[r.postId] = r.count;
  });
  const myReactionRows = await db
    .select({ postId: postReactions.postId, emoji: postReactions.emoji })
    .from(postReactions)
    .where(and(eq(postReactions.userId, userId), inArray(postReactions.postId, postIdsForCounts)));
  const myReactions: Record<string, string> = {};
  myReactionRows.forEach((r) => {
    myReactions[r.postId] = r.emoji;
  });
  return ordered.map((r) => {
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
      reactionUsers: {},
      myReaction: myReactions[r.id] ?? null,
      viewsCount: viewCounts[r.id] ?? 0,
      createdAt: r.createdAt?.toISOString?.() ?? null,
      author: postAuthorFromJoinRow(r),
      channelName: postChannelNameFromJoinRow(r),
      commentsCount: counts[r.id] ?? 0,
      latestComments: latestCommentsByPost[r.id] ?? [],
    };
  });
}
