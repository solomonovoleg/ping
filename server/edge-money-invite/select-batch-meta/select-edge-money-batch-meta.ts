import { eq } from "drizzle-orm";
import { edgeMoneyInviteBatches } from "@shared/schema";
import type { AppDb } from "../../storage/db-app-db";

export async function selectEdgeMoneyInviteBatchMeta(
  db: AppDb,
  batchId: string,
): Promise<{ edgeId: string; inviterUserId: string } | null> {
  const id = batchId.trim();
  if (!id) return null;
  const [row] = await db
    .select({
      edgeId: edgeMoneyInviteBatches.edgeId,
      inviterUserId: edgeMoneyInviteBatches.inviterUserId,
    })
    .from(edgeMoneyInviteBatches)
    .where(eq(edgeMoneyInviteBatches.id, id))
    .limit(1);
  if (!row) return null;
  const edgeId = row.edgeId?.trim() ?? "";
  const inviterUserId = row.inviterUserId?.trim() ?? "";
  if (!edgeId || !inviterUserId) return null;
  return { edgeId, inviterUserId };
}
