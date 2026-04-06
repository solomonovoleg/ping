import { sql } from "drizzle-orm";
import { edgeMoneyCallMinuteCounters } from "@shared/schema";
import { getDb } from "../db";

/** Добавить полные минуты разговора; возвращает новый `minute_total`. */
export async function incrementEdgeMoneyCallMinutes(
  userId: string,
  chatId: string,
  edgeId: string,
  deltaMinutes: number,
): Promise<number | null> {
  const u = userId.trim();
  const c = chatId.trim();
  const e = edgeId.trim();
  const d = Math.floor(deltaMinutes);
  if (!u || !c || !e || d < 1) return null;
  try {
    const db = getDb();
    const [row] = await db
      .insert(edgeMoneyCallMinuteCounters)
      .values({ userId: u, chatId: c, edgeId: e, minuteTotal: d, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          edgeMoneyCallMinuteCounters.userId,
          edgeMoneyCallMinuteCounters.chatId,
          edgeMoneyCallMinuteCounters.edgeId,
        ],
        set: {
          minuteTotal: sql`${edgeMoneyCallMinuteCounters.minuteTotal} + ${d}`,
          updatedAt: new Date(),
        },
      })
      .returning({ minuteTotal: edgeMoneyCallMinuteCounters.minuteTotal });
    const n = row?.minuteTotal;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch (err) {
    console.error("[edge-money-call-minutes] increment", err);
    return null;
  }
}
