import { sql } from "drizzle-orm";
import { edgeMoneyProfileLikeCounters } from "@shared/schema";
import { getDb } from "../db";

/** +1 к счётчику новых реакций на посты получателя в рамках кампании. */
export async function incrementEdgeMoneyProfileLikeCounter(
  recipientUserId: string,
  edgeId: string,
): Promise<number | null> {
  const r = recipientUserId.trim();
  const e = edgeId.trim();
  if (!r || !e) return null;
  try {
    const db = getDb();
    const [row] = await db
      .insert(edgeMoneyProfileLikeCounters)
      .values({ recipientUserId: r, edgeId: e, receivedCount: 1, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [edgeMoneyProfileLikeCounters.recipientUserId, edgeMoneyProfileLikeCounters.edgeId],
        set: {
          receivedCount: sql`${edgeMoneyProfileLikeCounters.receivedCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ receivedCount: edgeMoneyProfileLikeCounters.receivedCount });
    const n = row?.receivedCount;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch (err) {
    console.error("[edge-money-profile-likes] increment", err);
    return null;
  }
}
