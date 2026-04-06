import { sql } from "drizzle-orm";
import { edgeMoneyPostCounters } from "@shared/schema";
import { getDb } from "../db";

/** +1 к числу опубликованных постов автора в рамках кампании; возвращает новое `post_count`. */
export async function incrementEdgeMoneyPostCounter(
  userId: string,
  edgeId: string,
): Promise<number | null> {
  const u = userId.trim();
  const e = edgeId.trim();
  if (!u || !e) return null;
  try {
    const db = getDb();
    const [row] = await db
      .insert(edgeMoneyPostCounters)
      .values({ userId: u, edgeId: e, postCount: 1, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [edgeMoneyPostCounters.userId, edgeMoneyPostCounters.edgeId],
        set: {
          postCount: sql`${edgeMoneyPostCounters.postCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ postCount: edgeMoneyPostCounters.postCount });
    const n = row?.postCount;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch (err) {
    console.error("[edge-money-post-created] increment", err);
    return null;
  }
}
