import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { storage } from "../storage";
import { posts, users } from "@shared/schema";
import { getFeedAlgoConfig } from "../feed/config";
import { globalPublicFeedSelectFields } from "../feed/global-feed-row";
import {
  loadGlobalPublicFeedPageInline,
  tryLoadGlobalPublicFeedPage,
  tryLoadGlobalVideoFeedPage,
} from "../feed/load-global-feed-page";
import { rankGlobalPublicCandidateRows } from "../feed/rank-global-public-feed";
import { filterFeedRowsForEdgeAudience } from "./edge-display-audience";
import { sqlPostHasUploadedVideo } from "./post-has-uploaded-video-sql";
import type { ListPostsFeedRow, ListPostsForViewerParams } from "./list-posts-for-viewer-types";

export async function loadListPostsFeedRows(params: ListPostsForViewerParams): Promise<ListPostsFeedRow[]> {
  const { authorId, hashtagParam, qParam, videoOnly, limit, offset, viewerId } = params;
  const db = getDb();
  const hashtagCond = hashtagParam
    ? sql`${posts.hashtags} @> ${JSON.stringify([hashtagParam])}::jsonb`
    : undefined;
  const searchCond =
    qParam && qParam.length >= 2
      ? ilike(posts.text, `%${String(qParam).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`)
      : undefined;
  const draftCond = authorId === viewerId ? undefined : eq(posts.isDraft, false);
  let rows: ListPostsFeedRow[];

  if (authorId) {
    const wallCond = eq(posts.showOnAuthorWall, true);
    let whereClause: ReturnType<typeof and> | ReturnType<typeof eq> = draftCond
      ? and(eq(posts.authorId, authorId), draftCond, wallCond)
      : and(eq(posts.authorId, authorId), wallCond);
    if (hashtagCond) whereClause = and(whereClause, hashtagCond);
    if (searchCond) whereClause = and(whereClause, searchCond);
    if (videoOnly) whereClause = and(whereClause, sqlPostHasUploadedVideo());
    rows = await db
      .select(globalPublicFeedSelectFields)
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
  } else if (!hashtagParam && !qParam) {
    if (videoOnly) {
      const fromVideoSnap = await tryLoadGlobalVideoFeedPage(viewerId, limit, offset);
      if (fromVideoSnap !== null) {
        rows = fromVideoSnap;
      } else {
        rows = await loadGlobalPublicFeedPageInline(viewerId, limit, offset, { videoOnly: true });
      }
    } else {
      const fromSnap = await tryLoadGlobalPublicFeedPage(viewerId, limit, offset);
      if (fromSnap !== null) {
        rows = fromSnap;
      } else {
        rows = await loadGlobalPublicFeedPageInline(viewerId, limit, offset);
      }
    }
  } else {
    const blockedIds = await storage.getBlockedRelationIds(viewerId);
    const blockedSet = new Set(blockedIds);
    const algo = getFeedAlgoConfig();
    let baseWhere: ReturnType<typeof and> = and(
      eq(posts.isDraft, false),
      sql`coalesce(${posts.visibility}, 'public') = 'public'`,
      eq(posts.showOnAuthorWall, true),
    );
    if (hashtagCond) baseWhere = and(baseWhere, hashtagCond);
    if (searchCond) baseWhere = and(baseWhere, searchCond);
    if (videoOnly) baseWhere = and(baseWhere, sqlPostHasUploadedVideo());

    const rankingCandidateLimit = Math.min(
      Math.max(
        (limit + offset + algo.candidatePadding) * (videoOnly ? 4 : 1),
        (videoOnly ? 2 : 1) * algo.candidateMin,
      ),
      algo.candidateMax,
    );

    const rawRows = await db
      .select(globalPublicFeedSelectFields)
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
      const ranked = await rankGlobalPublicCandidateRows(db, feedRows, algo);
      rows = ranked.slice(offset, offset + limit);
    }
  }

  return filterFeedRowsForEdgeAudience(viewerId, rows);
}
