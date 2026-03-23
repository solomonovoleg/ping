import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { storage } from "../storage";
import { posts, users } from "@shared/schema";
import { getFeedAlgoConfig, getFeedSnapshotConfig } from "./config";
import { loadFeedGlobalSnapshot } from "./snapshot-store";
import type { GlobalPublicFeedRow } from "./rank-global-public-feed";
import {
  loadGlobalPublicCandidateRows,
  rankGlobalPublicCandidateRows,
} from "./rank-global-public-feed";

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
  edgeId: posts.edgeId,
  createdAt: posts.createdAt,
  authorDisplayName: users.displayName,
  authorSurname: users.surname,
  authorAvatarUrl: users.avatarUrl,
  authorPublicId: users.publicId,
};

async function loadGlobalRowsByIdsInOrder(orderedIds: string[]): Promise<GlobalPublicFeedRow[]> {
  if (orderedIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select(selectFields)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(eq(posts.isDraft, false), sql`coalesce(${posts.visibility}, 'public') = 'public'`, inArray(posts.id, orderedIds)),
    );
  const byId = new Map(rows.map((r) => [r.id, r as GlobalPublicFeedRow]));
  return orderedIds.map((id) => byId.get(id)).filter((x): x is GlobalPublicFeedRow => x != null);
}

/**
 * Страница глобальной ленты: при свежем снапшоте — без тяжёлого ранжирования на запросе.
 * Возвращает null → вызывающий считает ленту старым способом (хештег/поиск/устаревший снапшот).
 */
export async function tryLoadGlobalPublicFeedPage(viewerId: string, limit: number, offset: number): Promise<GlobalPublicFeedRow[] | null> {
  const snapCfg = getFeedSnapshotConfig();
  if (!snapCfg.snapshotReadEnabled) return null;

  const algo = getFeedAlgoConfig();
  const snap = await loadFeedGlobalSnapshot();
  if (!snap || snap.postIds.length === 0) return null;
  if (snap.algoMode !== algo.mode) return null;
  const ageSec = (Date.now() - snap.computedAt.getTime()) / 1000;
  if (ageSec > snapCfg.snapshotMaxAgeSec) return null;

  const blockedIds = await storage.getBlockedRelationIds(viewerId);
  const blockedSet = new Set(blockedIds);

  const db = getDb();
  const idList = snap.postIds;
  const metaRows = await db
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .where(inArray(posts.id, idList));
  const authorByPost = new Map(metaRows.map((r) => [r.id, r.authorId]));

  const filteredIds = idList.filter((pid) => {
    const aid = authorByPost.get(pid);
    return aid != null && !blockedSet.has(aid);
  });

  const pageIds = filteredIds.slice(offset, offset + limit);
  return loadGlobalRowsByIdsInOrder(pageIds);
}

/** Fallback: полный расчёт на запросе (как раньше), с фильтром блокировок до ранжирования. */
export async function loadGlobalPublicFeedPageInline(
  viewerId: string,
  limit: number,
  offset: number,
): Promise<GlobalPublicFeedRow[]> {
  const algo = getFeedAlgoConfig();
  const rankingCandidateLimit = Math.min(
    Math.max(limit + offset + algo.candidatePadding, algo.candidateMin),
    algo.candidateMax,
  );
  const blockedIds = await storage.getBlockedRelationIds(viewerId);
  const blockedSet = new Set(blockedIds);

  const db = getDb();
  const rawRows = await loadGlobalPublicCandidateRows(db, rankingCandidateLimit);
  const feedRows = rawRows.filter((r) => !blockedSet.has(r.authorId));
  if (feedRows.length === 0) return [];
  if (algo.mode === "strict_chrono") {
    return feedRows.slice(offset, offset + limit);
  }
  const ranked = await rankGlobalPublicCandidateRows(db, feedRows, algo);
  return ranked.slice(offset, offset + limit);
}
