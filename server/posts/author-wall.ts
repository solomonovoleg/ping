/**
 * Загрузка стены автора (посты по authorId). Используется для объединённого эндпоинта страницы профиля.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { posts, users, postComments, postReactions, postViews } from "@shared/schema";
import { storage } from "../storage";

type Row = {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  hashtags: string[] | null;
  isDraft: boolean;
  visibility: string;
  createdAt: Date;
  authorDisplayName: string | null;
  authorSurname: string | null;
  authorAvatarUrl: string | null;
  authorPublicId: number;
};

export type AuthorWallPost = {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[];
  hashtags: string[];
  reactions: { emoji: string; count: number }[];
  reactionUsers: Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>;
  myReaction: string | null;
  viewsCount: number;
  createdAt: string;
  author: { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null };
  channelName: string;
  commentsCount: number;
};

export async function getAuthorWall(
  viewerId: string,
  authorId: string,
  limit: number
): Promise<AuthorWallPost[]> {
  const db = getDb();
  const selectFields = {
    id: posts.id,
    authorId: posts.authorId,
    text: posts.text,
    imageUrl: posts.imageUrl,
    mediaUrls: posts.mediaUrls,
    hashtags: posts.hashtags,
    isDraft: posts.isDraft,
    visibility: posts.visibility,
    createdAt: posts.createdAt,
    authorDisplayName: users.displayName,
    authorSurname: users.surname,
    authorAvatarUrl: users.avatarUrl,
    authorPublicId: users.publicId,
  };
  const draftCond = authorId === viewerId ? undefined : eq(posts.isDraft, false);
  const whereClause = draftCond ? and(eq(posts.authorId, authorId), draftCond) : eq(posts.authorId, authorId);
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

  return rows.map((r: Row) => {
    const urls = (r.mediaUrls && Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0)
      ? r.mediaUrls
      : (r.imageUrl ? [r.imageUrl] : []);
    return {
      id: r.id,
      authorId: r.authorId,
      text: r.text,
      imageUrl: r.imageUrl ?? null,
      mediaUrls: urls,
      hashtags: (r.hashtags && Array.isArray(r.hashtags)) ? r.hashtags : [],
      reactions: reactionsByPost[r.id] ?? [],
      reactionUsers: reactionUsersByPost[r.id] ?? {},
      myReaction: myReactions[r.id] ?? null,
      viewsCount: viewCounts[r.id] ?? 0,
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
    };
  });
}
