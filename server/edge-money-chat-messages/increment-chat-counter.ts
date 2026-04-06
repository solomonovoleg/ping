import { sql } from "drizzle-orm";
import { edgeMoneyChatMessageCounters } from "@shared/schema";
import { getDb } from "../db";

/** +1 к счётчику в диалоге для кампании; возвращает новое значение `sent_count`. */
export async function incrementEdgeMoneyChatCounter(
  userId: string,
  chatId: string,
  edgeId: string,
): Promise<number | null> {
  const u = userId.trim();
  const c = chatId.trim();
  const e = edgeId.trim();
  if (!u || !c || !e) return null;
  try {
    const db = getDb();
    const [row] = await db
      .insert(edgeMoneyChatMessageCounters)
      .values({ userId: u, chatId: c, edgeId: e, sentCount: 1, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          edgeMoneyChatMessageCounters.userId,
          edgeMoneyChatMessageCounters.chatId,
          edgeMoneyChatMessageCounters.edgeId,
        ],
        set: {
          sentCount: sql`${edgeMoneyChatMessageCounters.sentCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ sentCount: edgeMoneyChatMessageCounters.sentCount });
    const n = row?.sentCount;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch (err) {
    console.error("[edge-money-chat-messages] increment", err);
    return null;
  }
}
