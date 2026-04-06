import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { storage } from "../storage";
import { posts, users } from "@shared/schema";
import { getFeedAlgoConfig, getFeedSnapshotConfig } from "./config";
import type { GlobalPublicFeedRow } from "./global-feed-row";
import { globalPublicFeedSelectFields } from "./global-feed-row";
import { loadFeedGlobalSnapshot } from "./snapshot-store";
import {
  loadGlobalPublicCandidateRows,
  rankGlobalPublicCandidateRows,
} from "./rank-global-public-feed";
import { filterFeedRowsForEdgeAudience } from "../posts/edge-display-audience";
import { sqlPostHasUploadedVideo } from "../posts/post-has-uploaded-video-sql";

async function loadGlobalRowsByIdsInOrder(orderedIds: string[]): Promise<GlobalPublicFeedRow[]> {
  if (orderedIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select(globalPublicFeedSelectFields)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        eq(posts.isDraft, false),
        sql`coalesce(${posts.visibility}, 'public') = 'public'`,
        eq(posts.showOnAuthorWall, true),
        inArray(posts.id, orderedIds),
      ),
    );
  const byId = new Map(rows.map((r) => [r.id, r as GlobalPublicFeedRow]));
  return orderedIds.map((id) => byId.get(id)).filter((x): x is GlobalPublicFeedRow => x != null);
}

/**
 * Страница глобальной ленты: при свежем снапшоте — без тяжёлого ранжирования на запросе.
 * Возвращает null → вызывающий считает ленту старым способом (хештег/поиск/устаревший снапшот).
 */
export async function tryLoadGlobalPublicFeedPage(
  viewerId: string,
  limit: number,
  offset: number,
): Promise<GlobalPublicFeedRow[] | null> {
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
  const loaded = await loadGlobalRowsByIdsInOrder(pageIds);
  return filterFeedRowsForEdgeAudience(viewerId, loaded);
}

const VIDEO_FEED_SNAPSHOT_BATCH = 140;
/** Не сканировать весь снапшот бесконечно — глубокие offset уходят в inline. */
const VIDEO_FEED_SNAPSHOT_MAX_IDS_SCANNED = 12_000;

/**
 * Как `tryLoadGlobalPublicFeedPage`, но только посты с загруженным видео, порядок = порядок в снапшоте.
 * Если не хватило видео в пределах скана — `null` → `loadGlobalPublicFeedPageInline({ videoOnly })`.
 */
export async function tryLoadGlobalVideoFeedPage(
  viewerId: string,
  limit: number,
  offset: number,
): Promise<GlobalPublicFeedRow[] | null> {
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

  const need = offset + limit;
  const videoOrdered: string[] = [];
  let scan = 0;
  let totalScanned = 0;

  while (videoOrdered.length < need && scan < filteredIds.length && totalScanned < VIDEO_FEED_SNAPSHOT_MAX_IDS_SCANNED) {
    const chunk = filteredIds.slice(scan, scan + VIDEO_FEED_SNAPSHOT_BATCH);
    scan += chunk.length;
    totalScanned += chunk.length;
    if (chunk.length === 0) break;

    const rows = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(inArray(posts.id, chunk), sqlPostHasUploadedVideo()));
    const videoSet = new Set(rows.map((r) => r.id));
    for (const id of chunk) {
      if (videoSet.has(id)) videoOrdered.push(id);
    }
  }

  const incomplete =
    videoOrdered.length < need &&
    totalScanned >= VIDEO_FEED_SNAPSHOT_MAX_IDS_SCANNED &&
    scan < filteredIds.length;
  if (incomplete) return null;

  const pageIds = videoOrdered.slice(offset, offset + limit);
  const loaded = await loadGlobalRowsByIdsInOrder(pageIds);
  return filterFeedRowsForEdgeAudience(viewerId, loaded);
}

/** Fallback: полный расчёт на запросе (как раньше), с фильтром блокировок до ранжирования. */
export async function loadGlobalPublicFeedPageInline(
  viewerId: string,
  limit: number,
  offset: number,
  opts?: { videoOnly?: boolean },
): Promise<GlobalPublicFeedRow[]> {
  const algo = getFeedAlgoConfig();
  const videoOnly = opts?.videoOnly === true;
  const rankingCandidateLimit = Math.min(
    Math.max(
      (limit + offset + algo.candidatePadding) * (videoOnly ? 4 : 1),
      (videoOnly ? 2 : 1) * algo.candidateMin,
    ),
    algo.candidateMax,
  );
  const blockedIds = await storage.getBlockedRelationIds(viewerId);
  const blockedSet = new Set(blockedIds);

  const db = getDb();
  const rawRows = await loadGlobalPublicCandidateRows(db, rankingCandidateLimit, { videoOnly });
  const feedRows = rawRows.filter((r) => !blockedSet.has(r.authorId));
  if (feedRows.length === 0) return [];
  let page: GlobalPublicFeedRow[];
  if (algo.mode === "strict_chrono") {
    page = feedRows.slice(offset, offset + limit);
  } else {
    const ranked = await rankGlobalPublicCandidateRows(db, feedRows, algo);
    page = ranked.slice(offset, offset + limit);
  }
  return filterFeedRowsForEdgeAudience(viewerId, page);
}
