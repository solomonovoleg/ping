import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { postComments, postReactions, postShares, posts, users } from "@shared/schema";
import type { getDb } from "../db";
import type { FeedAlgoConfig } from "./config";
import { sqlPostHasUploadedVideo } from "../posts/post-has-uploaded-video-sql";
import { globalPublicFeedSelectFields, type GlobalPublicFeedRow } from "./global-feed-row";

export type { GlobalPublicFeedRow } from "./global-feed-row";

type AppDb = ReturnType<typeof getDb>;

export async function loadGlobalPublicCandidateRows(
  db: AppDb,
  rankingCandidateLimit: number,
  opts?: { videoOnly?: boolean },
): Promise<GlobalPublicFeedRow[]> {
  const parts = [
    eq(posts.isDraft, false),
    sql`coalesce(${posts.visibility}, 'public') = 'public'`,
    eq(posts.showOnAuthorWall, true),
  ];
  if (opts?.videoOnly) parts.push(sqlPostHasUploadedVideo());
  const baseWhere = and(...parts);
  return db
    .select(globalPublicFeedSelectFields)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(baseWhere)
    .orderBy(desc(posts.createdAt))
    .limit(rankingCandidateLimit);
}

/** Ранжирование без учёта блок-листов (глобальный порядок для снапшота или fallback). */
export async function rankGlobalPublicCandidateRows(
  db: AppDb,
  feedRows: GlobalPublicFeedRow[],
  algo: FeedAlgoConfig,
): Promise<GlobalPublicFeedRow[]> {
  if (feedRows.length === 0) return [];
  if (algo.mode === "strict_chrono") {
    return feedRows;
  }
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
    .sort((a, b) => b.effectiveScore - a.effectiveScore || b.createdAtMs - a.createdAtMs);

  return rankedRows.map((x) => x.row);
}

export async function computeGlobalPublicFeedOrderedIds(
  db: AppDb,
  algo: FeedAlgoConfig,
): Promise<{ ids: string[]; candidateCount: number }> {
  const rankingCandidateLimit = algo.candidateMax;
  const candidates = await loadGlobalPublicCandidateRows(db, rankingCandidateLimit);
  const ranked = await rankGlobalPublicCandidateRows(db, candidates, algo);
  return { ids: ranked.map((r) => r.id), candidateCount: candidates.length };
}
