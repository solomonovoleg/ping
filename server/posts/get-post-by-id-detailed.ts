import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  postComments,
  postReactions,
  postShares,
  postViews,
  posts,
  savedPosts,
  users,
} from "@shared/schema";
import { normalizePostMediaPublic } from "./normalize-post-media";
import {
  postAuthorFromJoinRow,
  postChannelNameFromJoinRow,
  postEdgeDisplayAudiencePublic,
  postHashtagsPublic,
  postMediaLayoutPublic,
  postVisibilityPublic,
} from "./post-public-dto";
import { ensurePostReadableByViewer } from "./post-access";
import { PostsServiceError } from "./posts-service-error";

export async function getPostByIdDetailed(postRef: string, viewerId: string | null) {
  const ref = postRef.trim();
  if (!ref) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  const [row] = await db
    .select({
      id: posts.id,
      linkCode: posts.linkCode,
      authorId: posts.authorId,
      text: posts.text,
      imageUrl: posts.imageUrl,
      mediaUrls: posts.mediaUrls,
      mediaLayout: posts.mediaLayout,
      hashtags: posts.hashtags,
      createdAt: posts.createdAt,
      visibility: posts.visibility,
      isDraft: posts.isDraft,
      edgeId: posts.edgeId,
      edgeDisplayAudience: posts.edgeDisplayAudience,
      linkEmbedEnabled: posts.linkEmbedEnabled,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
      authorPublicId: users.publicId,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(or(eq(posts.id, ref), eq(posts.linkCode, ref)))
    .limit(1);
  if (!row) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const canonicalId = row.id;
  await ensurePostReadableByViewer(
    {
      authorId: row.authorId,
      visibility: row.visibility,
      isDraft: row.isDraft,
      edgeId: row.edgeId,
      edgeDisplayAudience: row.edgeDisplayAudience,
    },
    viewerId,
  );
  const { imageUrl: outImg, mediaUrls } = normalizePostMediaPublic(row.imageUrl, row.mediaUrls);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postComments)
    .where(eq(postComments.postId, canonicalId));
  const reactionRows = await db
    .select({ emoji: postReactions.emoji, count: sql<number>`count(*)::int` })
    .from(postReactions)
    .where(eq(postReactions.postId, canonicalId))
    .groupBy(postReactions.emoji);
  const whoReactedRows = await db
    .select({
      emoji: postReactions.emoji,
      userId: users.id,
      displayName: users.displayName,
      surname: users.surname,
      avatarUrl: users.avatarUrl,
    })
    .from(postReactions)
    .innerJoin(users, eq(postReactions.userId, users.id))
    .where(eq(postReactions.postId, canonicalId));
  const [viewRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postViews)
    .where(eq(postViews.postId, canonicalId));
  const [shareCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postShares)
    .where(eq(postShares.postId, canonicalId));
  let myReaction: string | null = null;
  let isSaved = false;
  if (viewerId) {
    const [my] = await db
      .select({ emoji: postReactions.emoji })
      .from(postReactions)
      .where(and(eq(postReactions.postId, canonicalId), eq(postReactions.userId, viewerId)))
      .limit(1);
    myReaction = my?.emoji ?? null;
    const [savedRow] = await db
      .select({ postId: savedPosts.postId })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, viewerId), eq(savedPosts.postId, canonicalId)))
      .limit(1);
    isSaved = !!savedRow;
  }
  const reactionUsersByPost: Record<
    string,
    { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]
  > = {};
  whoReactedRows.forEach((r) => {
    if (!reactionUsersByPost[r.emoji]) reactionUsersByPost[r.emoji] = [];
    reactionUsersByPost[r.emoji].push({
      id: r.userId,
      displayName: r.displayName ?? null,
      surname: r.surname ?? null,
      avatarUrl: r.avatarUrl ?? null,
    });
  });
  return {
    id: row.id,
    linkCode: row.linkCode,
    authorId: row.authorId,
    text: row.text,
    imageUrl: outImg,
    mediaUrls,
    mediaLayout: postMediaLayoutPublic(row.mediaLayout),
    hashtags: postHashtagsPublic(row.hashtags),
    edgeId: row.edgeId ?? null,
    visibility: postVisibilityPublic(row.visibility),
    edgeDisplayAudience: postEdgeDisplayAudiencePublic(row.edgeId, row.edgeDisplayAudience),
    linkEmbedEnabled: row.linkEmbedEnabled !== false,
    reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count })),
    reactionUsers: reactionUsersByPost,
    myReaction,
    viewsCount: viewRow?.count ?? 0,
    sharesCount: shareCountRow?.count ?? 0,
    isSaved,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
    author: postAuthorFromJoinRow(row),
    channelName: postChannelNameFromJoinRow(row),
    commentsCount: countRow?.count ?? 0,
  };
}
