import { and, eq, isNull } from "drizzle-orm";
import { edgeMoneyInviteBatches, referralCodes } from "@shared/schema";
import type { AppDb } from "../../storage/db-app-db";

function codeFullyConsumed(useCount: number, maxUses: number): boolean {
  if (maxUses === -1) return false;
  if (maxUses < 1) return useCount >= 1;
  return useCount >= maxUses;
}

/**
 * Если у партии не меньше slot_count кодов и каждый исчерпан по use_count — проставляет completed_at.
 */
export async function tryMarkEdgeMoneyInviteBatchCompleted(
  db: AppDb,
  batchId: string,
): Promise<boolean> {
  const [batch] = await db
    .select({
      id: edgeMoneyInviteBatches.id,
      slotCount: edgeMoneyInviteBatches.slotCount,
      completedAt: edgeMoneyInviteBatches.completedAt,
    })
    .from(edgeMoneyInviteBatches)
    .where(and(eq(edgeMoneyInviteBatches.id, batchId), isNull(edgeMoneyInviteBatches.completedAt)))
    .limit(1);
  if (!batch) return false;

  const codes = await db
    .select({
      useCount: referralCodes.useCount,
      maxUses: referralCodes.maxUses,
    })
    .from(referralCodes)
    .where(eq(referralCodes.edgeMoneyInviteBatchId, batchId));

  if (codes.length < batch.slotCount) return false;
  const allSaturated = codes.every((c) => codeFullyConsumed(c.useCount, c.maxUses));
  if (!allSaturated) return false;

  const now = new Date();
  const updated = await db
    .update(edgeMoneyInviteBatches)
    .set({ completedAt: now })
    .where(and(eq(edgeMoneyInviteBatches.id, batchId), isNull(edgeMoneyInviteBatches.completedAt)))
    .returning({ id: edgeMoneyInviteBatches.id });
  return updated.length === 1;
}
