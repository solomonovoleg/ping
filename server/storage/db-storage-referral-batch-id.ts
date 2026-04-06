import { eq } from "drizzle-orm";
import { referralCodes } from "@shared/schema";
import type { AppDb } from "./db-app-db";

function isMissingBatchIdColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Staged rollout / local DB without the new column yet.
  return /column/i.test(msg) && /edge_money_invite_batch_id/i.test(msg) && /does not exist/i.test(msg);
}

export async function dbStorageGetReferralCodeEdgeMoneyBatchId(
  db: AppDb,
  codeId: string,
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ bid: referralCodes.edgeMoneyInviteBatchId })
      .from(referralCodes)
      .where(eq(referralCodes.id, codeId))
      .limit(1);
    const v = row?.bid;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  } catch (err) {
    if (isMissingBatchIdColumnError(err)) return null;
    throw err;
  }
}
