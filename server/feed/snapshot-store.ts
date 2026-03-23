import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { feedGlobalSnapshot } from "@shared/schema";

export type FeedGlobalSnapshotRow = {
  computedAt: Date;
  algoMode: string;
  candidateCount: number;
  postIds: string[];
};

export async function loadFeedGlobalSnapshot(): Promise<FeedGlobalSnapshotRow | null> {
  const db = getDb();
  const [row] = await db.select().from(feedGlobalSnapshot).where(eq(feedGlobalSnapshot.id, 1)).limit(1);
  if (!row) return null;
  const ids = Array.isArray(row.postIds) ? row.postIds.filter((x): x is string => typeof x === "string") : [];
  return {
    computedAt: row.computedAt,
    algoMode: row.algoMode,
    candidateCount: row.candidateCount,
    postIds: ids,
  };
}

export async function saveFeedGlobalSnapshot(input: {
  postIds: string[];
  algoMode: string;
  candidateCount: number;
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(feedGlobalSnapshot)
    .values({
      id: 1,
      computedAt: now,
      algoMode: input.algoMode,
      candidateCount: input.candidateCount,
      postIds: input.postIds,
    })
    .onConflictDoUpdate({
      target: feedGlobalSnapshot.id,
      set: {
        computedAt: now,
        algoMode: input.algoMode,
        candidateCount: input.candidateCount,
        postIds: input.postIds,
      },
    });
}
