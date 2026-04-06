import { randomUUID } from "crypto";
import { and, eq, max } from "drizzle-orm";
import { edgeMoneyInviteBatches } from "@shared/schema";
import type { AppDb } from "../../storage/db-app-db";

export type InsertEdgeMoneyInviteBatchResult = {
  id: string;
  batchIndex: number;
  slotCount: number;
};

/**
 * Создаёт новую партию. Не проверяет gate — вызывайте после evaluateNewEdgeMoneyInviteBatchAllowed.
 */
export async function insertEdgeMoneyInviteBatch(
  db: AppDb,
  inviterUserId: string,
  edgeId: string,
  slotCount = 3,
): Promise<InsertEdgeMoneyInviteBatchResult> {
  const safeSlots = Math.min(50, Math.max(1, Math.floor(slotCount)));
  const [agg] = await db
    .select({ m: max(edgeMoneyInviteBatches.batchIndex) })
    .from(edgeMoneyInviteBatches)
    .where(
      and(eq(edgeMoneyInviteBatches.inviterUserId, inviterUserId), eq(edgeMoneyInviteBatches.edgeId, edgeId)),
    );
  const prev = agg?.m;
  const batchIndex = typeof prev === "number" && Number.isFinite(prev) ? prev + 1 : 0;
  const id = randomUUID();
  await db.insert(edgeMoneyInviteBatches).values({
    id,
    inviterUserId,
    edgeId,
    batchIndex,
    slotCount: safeSlots,
  });
  return { id, batchIndex, slotCount: safeSlots };
}
