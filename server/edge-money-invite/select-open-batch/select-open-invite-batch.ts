import { and, desc, eq, isNull } from "drizzle-orm";
import { edgeMoneyInviteBatches } from "@shared/schema";
import type { AppDb } from "../../storage/db-app-db";

export type OpenInviteBatchRow = {
  id: string;
  inviterUserId: string;
  edgeId: string;
  batchIndex: number;
  slotCount: number;
  createdAt: Date;
  completedAt: Date | null;
};

/** Активная партия: completed_at IS NULL (ещё не закрыта учётом потребления кодов). */
export async function selectOpenInviteBatchForUserEdge(
  db: AppDb,
  inviterUserId: string,
  edgeId: string,
): Promise<OpenInviteBatchRow | null> {
  const [row] = await db
    .select({
      id: edgeMoneyInviteBatches.id,
      inviterUserId: edgeMoneyInviteBatches.inviterUserId,
      edgeId: edgeMoneyInviteBatches.edgeId,
      batchIndex: edgeMoneyInviteBatches.batchIndex,
      slotCount: edgeMoneyInviteBatches.slotCount,
      createdAt: edgeMoneyInviteBatches.createdAt,
      completedAt: edgeMoneyInviteBatches.completedAt,
    })
    .from(edgeMoneyInviteBatches)
    .where(
      and(
        eq(edgeMoneyInviteBatches.inviterUserId, inviterUserId),
        eq(edgeMoneyInviteBatches.edgeId, edgeId),
        isNull(edgeMoneyInviteBatches.completedAt),
      ),
    )
    .orderBy(desc(edgeMoneyInviteBatches.batchIndex))
    .limit(1);
  return row ?? null;
}
