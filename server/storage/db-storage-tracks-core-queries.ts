import { eq, and, desc, sql, isNull, isNotNull } from "drizzle-orm";
import { tracks, trackItems, callTrackItems } from "@shared/schema";
import { mergeTracksStatsAggregates } from "./db-storage-tracks-stats-merge";
import type { AppDb } from "./db-app-db";

export async function dbStorageCreateTrack(
  db: AppDb,
  userId: string,
  name: string,
): Promise<{ id: string; name: string; createdAt: Date }> {
  const [row] = await db.insert(tracks).values({ userId, name: name.trim() || "Новый трек" }).returning();
  if (!row) throw new Error("Create track failed");
  return { id: row.id, name: row.name, createdAt: row.createdAt };
}

export async function dbStorageListTracks(
  db: AppDb,
  userId: string,
): Promise<
  { id: string; name: string; createdAt: Date; totalItems: number; activeItems: number; doneItems: number }[]
> {
  const trackRows = await db
    .select({ id: tracks.id, name: tracks.name, createdAt: tracks.createdAt })
    .from(tracks)
    .where(eq(tracks.userId, userId))
    .orderBy(desc(tracks.createdAt));
  const messageCounts = await db
    .select({
      trackId: trackItems.trackId,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${trackItems.doneAt} is null)::int`,
      done: sql<number>`count(*) filter (where ${trackItems.doneAt} is not null)::int`,
    })
    .from(trackItems)
    .groupBy(trackItems.trackId);
  const callCounts = await db
    .select({
      trackId: callTrackItems.trackId,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${callTrackItems.doneAt} is null)::int`,
      done: sql<number>`count(*) filter (where ${callTrackItems.doneAt} is not null)::int`,
    })
    .from(callTrackItems)
    .groupBy(callTrackItems.trackId);
  const countMap = new Map<string, { total: number; active: number; done: number }>();
  for (const c of messageCounts) countMap.set(c.trackId, { total: c.total, active: c.active, done: c.done });
  for (const c of callCounts) {
    const prev = countMap.get(c.trackId) ?? { total: 0, active: 0, done: 0 };
    countMap.set(c.trackId, {
      total: prev.total + c.total,
      active: prev.active + c.active,
      done: prev.done + c.done,
    });
  }
  return trackRows.map((t) => {
    const c = countMap.get(t.id) ?? { total: 0, active: 0, done: 0 };
    return { ...t, totalItems: c.total, activeItems: c.active, doneItems: c.done };
  });
}

export async function dbStorageGetTrack(
  db: AppDb,
  userId: string,
  trackId: string,
): Promise<{ id: string; name: string; createdAt: Date } | undefined> {
  const [row] = await db
    .select({ id: tracks.id, name: tracks.name, createdAt: tracks.createdAt })
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)))
    .limit(1);
  return row;
}

export async function dbStorageUpdateTrack(
  db: AppDb,
  userId: string,
  trackId: string,
  data: { name: string },
): Promise<void> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) throw new Error("Трек не найден");
  await db
    .update(tracks)
    .set({ name: data.name.trim() || track.name })
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
}

export async function dbStorageDeleteTrack(db: AppDb, userId: string, trackId: string): Promise<void> {
  const track = await dbStorageGetTrack(db, userId, trackId);
  if (!track) throw new Error("Трек не найден");
  await db.delete(tracks).where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
}

export async function dbStorageGetTracksStats(
  db: AppDb,
  userId: string,
): Promise<{ totalTracks: number; activeItemsCount: number; doneItemsCount: number; lastAddedAt: Date | null }> {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tracks)
    .where(eq(tracks.userId, userId));
  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trackItems)
    .innerJoin(tracks, eq(tracks.id, trackItems.trackId))
    .where(and(eq(tracks.userId, userId), isNull(trackItems.doneAt)));
  const [doneRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trackItems)
    .innerJoin(tracks, eq(tracks.id, trackItems.trackId))
    .where(and(eq(tracks.userId, userId), isNotNull(trackItems.doneAt)));
  const [lastRow] = await db
    .select({ lastAdded: sql<Date>`max(${trackItems.addedAt})` })
    .from(trackItems)
    .innerJoin(tracks, eq(tracks.id, trackItems.trackId))
    .where(eq(tracks.userId, userId));
  const [activeCallRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(callTrackItems)
    .innerJoin(tracks, eq(tracks.id, callTrackItems.trackId))
    .where(and(eq(tracks.userId, userId), isNull(callTrackItems.doneAt)));
  const [doneCallRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(callTrackItems)
    .innerJoin(tracks, eq(tracks.id, callTrackItems.trackId))
    .where(and(eq(tracks.userId, userId), isNotNull(callTrackItems.doneAt)));
  const [lastCallRow] = await db
    .select({ lastAdded: sql<Date>`max(${callTrackItems.addedAt})` })
    .from(callTrackItems)
    .innerJoin(tracks, eq(tracks.id, callTrackItems.trackId))
    .where(eq(tracks.userId, userId));
  return mergeTracksStatsAggregates({
    totalTracks: totalRow?.count ?? 0,
    activeMessageItems: activeRow?.count ?? 0,
    doneMessageItems: doneRow?.count ?? 0,
    lastMessageAdded: lastRow?.lastAdded ?? null,
    activeCallItems: activeCallRow?.count ?? 0,
    doneCallItems: doneCallRow?.count ?? 0,
    lastCallAdded: lastCallRow?.lastAdded ?? null,
  });
}

export async function dbStorageFindBestUserTrackByName(
  db: AppDb,
  userId: string,
  nameQuery: string,
): Promise<{ id: string; name: string } | null> {
  const q = nameQuery.trim().toLowerCase().replace(/ё/g, "е");
  if (!q) return null;
  const list = await dbStorageListTracks(db, userId);
  let best: { id: string; name: string; score: number } | null = null;
  for (const t of list) {
    const n = t.name.trim().toLowerCase().replace(/ё/g, "е");
    let score = 0;
    if (n === q) score = 100;
    else if (n.startsWith(q)) score = 88;
    else if (n.includes(q)) score = 75;
    else if (q.length >= 4 && n.includes(q.slice(0, Math.max(3, q.length - 1)))) score = 55;
    if (score > 0 && (!best || score > best.score)) best = { id: t.id, name: t.name, score };
  }
  return best ? { id: best.id, name: best.name } : null;
}
