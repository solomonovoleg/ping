import { and, desc, eq, gt, ilike, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notifyMentionsPost } from "../notifications/mentions";
import { notifyChatListUpdate } from "../calls/ws";
import { storage } from "../storage";
import {
  extractHashtags,
  extractMentions,
  MAX_POST_MENTIONS,
  postComments,
  postReactions,
  postShares,
  postViews,
  posts,
  savedPosts,
  users,
} from "@shared/schema";
import { getFeedAlgoConfig } from "../feed/config";
import type { PostMediaLayout } from "@shared/post-media-layout";

export class PostsServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type CreatePostInput = {
  userId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  mediaLayout: PostMediaLayout | null;
  isDraft: boolean;
  visibility: "public" | "followers";
};

export async function createPost(input: CreatePostInput) {
  const { userId, text, imageUrl, mediaUrls, mediaLayout, isDraft, visibility } = input;
  const mentionTokens = extractMentions(text);
  if (mentionTokens.length > MAX_POST_MENTIONS) {
    throw new PostsServiceError(400, `Не больше ${MAX_POST_MENTIONS} упоминаний (@) в посте`);
  }
  const firstUrl = mediaUrls?.length ? mediaUrls[0] : imageUrl;
  const hashtags = extractHashtags(text);
  const db = getDb();
  const [row] = await db
    .insert(posts)
    .values({
      authorId: userId,
      text,
      imageUrl: firstUrl ?? null,
      mediaUrls: mediaUrls ?? (imageUrl ? [imageUrl] : null),
      mediaLayout,
      hashtags: hashtags.length > 0 ? hashtags : null,
      isDraft: !!isDraft,
      visibility,
    })
    .returning();
  if (!row) {
    throw new PostsServiceError(500, "Не удалось создать пост");
  }
  if (!isDraft) {
    notifyMentionsPost(row.id, userId, text, storage).catch((e) => console.error("[posts] notify mentions:", e));
  }
  const urls = (row.mediaUrls as string[] | null)?.length ? (row.mediaUrls as string[]) : row.imageUrl ? [row.imageUrl] : [];
  return {
    id: row.id,
    authorId: row.authorId,
    text: row.text,
    imageUrl: row.imageUrl ?? null,
    mediaUrls: urls,
    mediaLayout: (row.mediaLayout as PostMediaLayout | null) ?? null,
    isDraft: row.isDraft ?? false,
    visibility: row.visibility ?? "public",
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function recordPostView(postId: string, userId: string): Promise<void> {
  const db = getDb();
  await db.insert(postViews).values({ postId, userId }).onConflictDoNothing();
}

export type PostEngagementInput = {
  dwellMs?: number;
  expanded?: boolean;
  readFull?: boolean;
};

/**
 * Базовая запись engagement-сигнала для будущего ранкера.
 * Пока сохраняем уникальный просмотр как устойчивый минимум,
 * а расширенные сигналы подключим после миграции схемы.
 */
export async function recordPostEngagement(
  postId: string,
  userId: string,
  _engagement: PostEngagementInput = {}
): Promise<void> {
  await recordPostView(postId, userId);
}

export async function deleteOwnPost(postId: string, userId: string): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  if (existing.authorId !== userId) {
    throw new PostsServiceError(403, "Можно удалить только свой пост");
  }
  await db.delete(posts).where(eq(posts.id, postId));
}

type UpdatePostInput = {
  postId: string;
  userId: string;
  text?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  mediaLayout?: PostMediaLayout | null;
  isDraft?: boolean;
  visibility?: "public" | "followers";
};

export async function updateOwnPost(input: UpdatePostInput) {
  const { postId, userId, text, imageUrl, mediaUrls, mediaLayout, isDraft, visibility } = input;
  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  if (existing.authorId !== userId) {
    throw new PostsServiceError(403, "Можно редактировать только свой пост");
  }
  const updates: {
    text?: string;
    imageUrl?: string | null;
    mediaUrls?: string[] | null;
    mediaLayout?: PostMediaLayout | null;
    hashtags?: string[] | null;
    isDraft?: boolean;
    visibility?: string;
  } = {};
  if (text !== undefined) {
    updates.text = text;
    const tags = extractHashtags(text);
    updates.hashtags = tags.length > 0 ? tags : null;
  }
  if (typeof isDraft === "boolean") updates.isDraft = isDraft;
  if (visibility === "public" || visibility === "followers") updates.visibility = visibility;
  if (mediaLayout !== undefined) updates.mediaLayout = mediaLayout;
  if (mediaUrls !== undefined) {
    updates.mediaUrls = mediaUrls.length ? mediaUrls : null;
    updates.imageUrl = mediaUrls.length ? mediaUrls[0] : null;
  } else if (imageUrl !== undefined) {
    updates.imageUrl = imageUrl;
    updates.mediaUrls = imageUrl ? [imageUrl] : null;
  }
  if (Object.keys(updates).length === 0) {
    const urls = (existing.mediaUrls as string[] | null)?.length
      ? (existing.mediaUrls as string[])
      : existing.imageUrl
        ? [existing.imageUrl]
        : [];
    return {
      id: existing.id,
      text: existing.text,
      imageUrl: existing.imageUrl ?? null,
      mediaUrls: urls,
      mediaLayout: (existing.mediaLayout as PostMediaLayout | null) ?? null,
      createdAt: existing.createdAt?.toISOString?.(),
    };
  }
  const [row] = await db.update(posts).set(updates).where(eq(posts.id, postId)).returning();
  if (!row) {
    throw new PostsServiceError(500, "Не удалось обновить пост");
  }
  const urls = (row.mediaUrls as string[] | null)?.length ? (row.mediaUrls as string[]) : row.imageUrl ? [row.imageUrl] : [];
  return {
    id: row.id,
    text: row.text,
    imageUrl: row.imageUrl ?? null,
    mediaUrls: urls,
    mediaLayout: (row.mediaLayout as PostMediaLayout | null) ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function sharePostToUser(postId: string, fromUserId: string, toUserId: string): Promise<{ chatId: string }> {
  if (toUserId === fromUserId) {
    throw new PostsServiceError(400, "Нельзя отправить пост себе");
  }
  const db = getDb();
  const [postRow] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!postRow) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const toUser = await storage.getUser(toUserId);
  if (!toUser || toUser.deletedAt || toUser.isBlocked) {
    throw new PostsServiceError(404, "Пользователь не найден");
  }
  const chat = await storage.getOrCreateDmChat(fromUserId, toUserId);
  notifyChatListUpdate(toUserId);
  const author = await storage.getUser(postRow.authorId);
  const authorName = author ? [author.displayName, author.surname].filter(Boolean).join(" ") || `ID ${author.publicId}` : "Пользователь";
  await db.insert(postShares).values({
    postId,
    fromUserId,
    toUserId,
  });
  const previewContent = JSON.stringify({
    postId,
    text: postRow.text?.slice(0, 200) ?? "",
    imageUrl: postRow.imageUrl ?? null,
    authorName,
    authorId: postRow.authorId,
  });
  await storage.createMessage({
    chatId: chat.id,
    senderId: fromUserId,
    type: "post_share",
    content: previewContent,
  });
  return { chatId: chat.id };
}

export async function savePost(userId: string, postId: string): Promise<void> {
  const db = getDb();
  const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  await db.insert(savedPosts).values({ userId, postId }).onConflictDoNothing();
}

export async function unsavePost(userId: string, postId: string): Promise<void> {
  const db = getDb();
  await db.delete(savedPosts).where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
}

type FeedRow = {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  mediaLayout: PostMediaLayout | null;
  hashtags: string[] | null;
  isDraft: boolean;
  visibility: string;
  createdAt: Date;
  authorDisplayName: string | null;
  authorSurname: string | null;
  authorAvatarUrl: string | null;
  authorPublicId: number;
};

export async function listPostsForViewer(params: {
  authorId?: string;
  hashtagParam?: string;
  qParam?: string;
  limit: number;
  offset: number;
  viewerId: string;
}) {
  const { authorId, hashtagParam, qParam, limit, offset, viewerId } = params;
  const db = getDb();
  const selectFields = {
    id: posts.id,
    authorId: posts.authorId,
    text: posts.text,
    imageUrl: posts.imageUrl,
    mediaUrls: posts.mediaUrls,
    mediaLayout: posts.mediaLayout,
    hashtags: posts.hashtags,
    isDraft: posts.isDraft,
    visibility: posts.visibility,
    createdAt: posts.createdAt,
    authorDisplayName: users.displayName,
    authorSurname: users.surname,
    authorAvatarUrl: users.avatarUrl,
    authorPublicId: users.publicId,
  };
  const hashtagCond = hashtagParam
    ? sql`${posts.hashtags} @> ${JSON.stringify([hashtagParam])}::jsonb`
    : undefined;
  const searchCond =
    qParam && qParam.length >= 2
      ? ilike(posts.text, `%${String(qParam).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`)
      : undefined;
  const draftCond = authorId === viewerId ? undefined : eq(posts.isDraft, false);
  let rows: FeedRow[];

  if (authorId) {
    let whereClause: ReturnType<typeof and> | ReturnType<typeof eq> = draftCond ? and(eq(posts.authorId, authorId), draftCond) : eq(posts.authorId, authorId);
    if (hashtagCond) whereClause = and(whereClause, hashtagCond);
    if (searchCond) whereClause = and(whereClause, searchCond);
    rows = await db
      .select(selectFields)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);
    if (authorId !== viewerId && rows.length > 0) {
      const isFollower = await storage.isFollowing(viewerId, authorId);
      if (!isFollower) {
        rows = rows.filter((r) => (r.visibility ?? "public").toLowerCase() === "public");
      }
    }
  } else {
    const blockedIds = await storage.getBlockedRelationIds(viewerId);
    const blockedSet = new Set(blockedIds);
    const algo = getFeedAlgoConfig();
    let baseWhere: ReturnType<typeof and> = and(
      eq(posts.isDraft, false),
      sql`coalesce(${posts.visibility}, 'public') = 'public'`,
    );
    if (hashtagCond) baseWhere = and(baseWhere, hashtagCond);
    if (searchCond) baseWhere = and(baseWhere, searchCond);

    const rankingCandidateLimit = Math.min(
      Math.max(limit + offset + algo.candidatePadding, algo.candidateMin),
      algo.candidateMax,
    );

    const rawRows = await db
      .select(selectFields)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(baseWhere)
      .orderBy(desc(posts.createdAt))
      .limit(rankingCandidateLimit);

    const feedRows = rawRows.filter((r) => !blockedSet.has(r.authorId));
    if (feedRows.length === 0) {
      rows = [];
    } else if (algo.mode === "strict_chrono") {
      rows = feedRows.slice(offset, offset + limit);
    } else {
      const nowMs = Date.now();
      const boostSince = new Date(nowMs - algo.boostWindowHours * 60 * 60 * 1000);
      const feedPostIds = feedRows.map((r) => r.id);
      const authorByPost = new Map(feedRows.map((r) => [r.id, r.authorId]));

      const reactionRows = await db
        .select({ postId: postReactions.postId, userId: postReactions.userId, userCreatedAt: users.createdAt })
        .from(postReactions)
        .innerJoin(users, eq(postReactions.userId, users.id))
        .where(and(inArray(postReactions.postId, feedPostIds), gt(postReactions.createdAt, boostSince)));

      const commentRows = await db
        .select({ postId: postComments.postId, userId: postComments.userId, userCreatedAt: users.createdAt })
        .from(postComments)
        .innerJoin(users, eq(postComments.userId, users.id))
        .where(and(inArray(postComments.postId, feedPostIds), gt(postComments.createdAt, boostSince)));

      const shareRows = await db
        .select({ postId: postShares.postId, userId: postShares.fromUserId, userCreatedAt: users.createdAt })
        .from(postShares)
        .innerJoin(users, eq(postShares.fromUserId, users.id))
        .where(and(inArray(postShares.postId, feedPostIds), gt(postShares.createdAt, boostSince)));

      const antiSpamFactor = (userCreatedAt: Date | null): number => {
        if (!userCreatedAt) return 1;
        const ageHours = (nowMs - userCreatedAt.getTime()) / (60 * 60 * 1000);
        if (ageHours < algo.veryNewAccountHours) return algo.veryNewAccountFactor;
        if (ageHours < algo.newAccountHours) return algo.newAccountFactor;
        return 1;
      };

      const reactionUniqueByPost = new Map<string, Map<string, number>>();
      reactionRows.forEach((r) => {
        const authorIdForPost = authorByPost.get(r.postId);
        if (authorIdForPost && authorIdForPost === r.userId) return;
        if (!reactionUniqueByPost.has(r.postId)) reactionUniqueByPost.set(r.postId, new Map());
        reactionUniqueByPost.get(r.postId)!.set(r.userId, antiSpamFactor(r.userCreatedAt));
      });

      const commentUniqueByPost = new Map<string, Map<string, number>>();
      commentRows.forEach((r) => {
        const authorIdForPost = authorByPost.get(r.postId);
        if (authorIdForPost && authorIdForPost === r.userId) return;
        if (!commentUniqueByPost.has(r.postId)) commentUniqueByPost.set(r.postId, new Map());
        commentUniqueByPost.get(r.postId)!.set(r.userId, antiSpamFactor(r.userCreatedAt));
      });

      const shareUniqueByPost = new Map<string, Map<string, number>>();
      shareRows.forEach((r) => {
        const authorIdForPost = authorByPost.get(r.postId);
        if (authorIdForPost && authorIdForPost === r.userId) return;
        if (!shareUniqueByPost.has(r.postId)) shareUniqueByPost.set(r.postId, new Map());
        shareUniqueByPost.get(r.postId)!.set(r.userId, antiSpamFactor(r.userCreatedAt));
      });

      const rankedRows = feedRows
        .map((r) => {
          const createdAtMs = r.createdAt.getTime();
          const ageHours = Math.max(0, (nowMs - createdAtMs) / (60 * 60 * 1000));
          const reactionsWeight = Array.from(reactionUniqueByPost.get(r.id)?.values() ?? []).reduce((sum, v) => sum + v, 0);
          const commentsWeight = Array.from(commentUniqueByPost.get(r.id)?.values() ?? []).reduce((sum, v) => sum + v, 0);
          const sharesWeight = Array.from(shareUniqueByPost.get(r.id)?.values() ?? []).reduce((sum, v) => sum + v, 0);
          const reactionsBoost = reactionsWeight * algo.reactionBoostMinutes;
          const commentsBoost = commentsWeight * algo.commentBoostMinutes;
          const sharesBoost = sharesWeight * algo.shareBoostMinutes;
          const boostMinutes = Math.min(algo.boostCapMinutes, reactionsBoost + commentsBoost + sharesBoost);
          const agePenaltyMinutes = ageHours > algo.boostWindowHours ? (ageHours - algo.boostWindowHours) * 60 : 0;
          const effectiveScore = createdAtMs + (boostMinutes - agePenaltyMinutes) * 60 * 1000;
          return { row: r, effectiveScore, createdAtMs };
        })
        .sort((a, b) => (b.effectiveScore - a.effectiveScore) || (b.createdAtMs - a.createdAtMs));

      rows = rankedRows.slice(offset, offset + limit).map((x) => x.row);
    }
  }

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
    const shareRows = await db
      .select({ postId: postShares.postId, count: sql<number>`count(*)::int` })
      .from(postShares)
      .where(inArray(postShares.postId, postIds))
      .groupBy(postShares.postId);
    shareRows.forEach((r) => {
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
    const urls = (r.mediaUrls && Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0)
      ? r.mediaUrls
      : (r.imageUrl ? [r.imageUrl] : []);
    return {
      id: r.id,
      authorId: r.authorId,
      text: r.text,
      imageUrl: r.imageUrl ?? null,
      mediaUrls: urls,
      mediaLayout: (r.mediaLayout as PostMediaLayout | null) ?? null,
      hashtags: (r.hashtags && Array.isArray(r.hashtags)) ? r.hashtags : [],
      reactions: reactionsByPost[r.id] ?? [],
      reactionUsers: reactionUsersByPost[r.id] ?? {},
      myReaction: myReactions[r.id] ?? null,
      viewsCount: viewCounts[r.id] ?? 0,
      sharesCount: shareCounts[r.id] ?? 0,
      isSaved: savedPostIds.has(r.id),
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
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

type LatestCommentRow = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date | string;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
};

function extractQueryRows<T>(queryResult: unknown): T[] {
  if (Array.isArray(queryResult)) return queryResult as T[];
  if (queryResult && typeof queryResult === "object") {
    const rows = (queryResult as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

async function loadLatestCommentsByPostIds(postIds: string[]) {
  const latestCommentsByPost: Record<
    string,
    { id: string; postId: string; userId: string; text: string; createdAt: string; user: string; avatar: string | null; likes: number }[]
  > = {};
  if (postIds.length === 0) return latestCommentsByPost;
  const db = getDb();
  const idList = sql.join(postIds.map((id) => sql`${id}`), sql`, `);
  const latestCommentQuery = await db.execute(sql`
    select c.id,
           c.post_id as "postId",
           c.user_id as "userId",
           c.text,
           c.created_at as "createdAt",
           u.display_name as "displayName",
           u.surname as "surname",
           u.avatar_url as "avatarUrl"
    from (
      select pc.id,
             pc.post_id,
             pc.user_id,
             pc.text,
             pc.created_at,
             row_number() over (partition by pc.post_id order by pc.created_at desc) as rn
      from post_comments pc
      where pc.post_id in (${idList})
    ) c
    left join users u on u.id = c.user_id
    where c.rn <= 2
    order by c.post_id asc, c.created_at desc
  `);
  const latestCommentRows = extractQueryRows<LatestCommentRow>(latestCommentQuery);
  latestCommentRows.forEach((r) => {
    if (!latestCommentsByPost[r.postId]) latestCommentsByPost[r.postId] = [];
    latestCommentsByPost[r.postId].push({
      id: r.id,
      postId: r.postId,
      userId: r.userId,
      text: r.text,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      user: [r.displayName, r.surname].filter(Boolean).join(" ") || "Пользователь",
      avatar: r.avatarUrl ?? null,
      likes: 0,
    });
  });
  return latestCommentsByPost;
}

export async function getPostByIdDetailed(postId: string, viewerId: string | null) {
  const db = getDb();
  const [row] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      text: posts.text,
      imageUrl: posts.imageUrl,
      mediaUrls: posts.mediaUrls,
      mediaLayout: posts.mediaLayout,
      hashtags: posts.hashtags,
      createdAt: posts.createdAt,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
      authorPublicId: users.publicId,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const mediaUrls = (row.mediaUrls as string[] | null)?.length ? (row.mediaUrls as string[]) : row.imageUrl ? [row.imageUrl] : [];
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postComments)
    .where(eq(postComments.postId, postId));
  const reactionRows = await db
    .select({ emoji: postReactions.emoji, count: sql<number>`count(*)::int` })
    .from(postReactions)
    .where(eq(postReactions.postId, postId))
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
    .where(eq(postReactions.postId, postId));
  const [viewRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postViews)
    .where(eq(postViews.postId, postId));
  const [shareCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postShares)
    .where(eq(postShares.postId, postId));
  let myReaction: string | null = null;
  let isSaved = false;
  if (viewerId) {
    const [my] = await db
      .select({ emoji: postReactions.emoji })
      .from(postReactions)
      .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, viewerId)))
      .limit(1);
    myReaction = my?.emoji ?? null;
    const [savedRow] = await db
      .select({ postId: savedPosts.postId })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, viewerId), eq(savedPosts.postId, postId)))
      .limit(1);
    isSaved = !!savedRow;
  }
  const reactionUsersByPost: Record<string, { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> = {};
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
    authorId: row.authorId,
    text: row.text,
    imageUrl: row.imageUrl ?? null,
    mediaUrls,
    mediaLayout: (row.mediaLayout as PostMediaLayout | null) ?? null,
    hashtags: (row.hashtags && Array.isArray(row.hashtags)) ? row.hashtags : [],
    reactions: reactionRows.map((r) => ({ emoji: r.emoji, count: r.count })),
    reactionUsers: reactionUsersByPost,
    myReaction,
    viewsCount: viewRow?.count ?? 0,
    sharesCount: shareCountRow?.count ?? 0,
    isSaved,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
    author: {
      id: row.authorId,
      publicId: row.authorPublicId,
      displayName: row.authorDisplayName ?? null,
      surname: row.authorSurname ?? null,
      avatarUrl: row.authorAvatarUrl ?? null,
    },
    channelName: [row.authorDisplayName, row.authorSurname].filter(Boolean).join(" ") || `ID ${row.authorPublicId}`,
    commentsCount: countRow?.count ?? 0,
  };
}

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
      authorId: posts.authorId,
      text: posts.text,
      imageUrl: posts.imageUrl,
      mediaUrls: posts.mediaUrls,
      mediaLayout: posts.mediaLayout,
      hashtags: posts.hashtags,
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
    const urls = (r.mediaUrls && Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0) ? r.mediaUrls : (r.imageUrl ? [r.imageUrl] : []);
    return {
      id: r.id,
      authorId: r.authorId,
      text: r.text,
      imageUrl: r.imageUrl ?? null,
      mediaUrls: urls,
      mediaLayout: (r.mediaLayout as PostMediaLayout | null) ?? null,
      hashtags: (r.hashtags && Array.isArray(r.hashtags)) ? r.hashtags : [],
      reactions: reactionsByPost[r.id] ?? [],
      reactionUsers: {},
      myReaction: myReactions[r.id] ?? null,
      viewsCount: viewCounts[r.id] ?? 0,
      createdAt: r.createdAt?.toISOString?.() ?? null,
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
