import { eq, sql } from "drizzle-orm";
import { referralCodes } from "@shared/schema";
import type { AppDb } from "../../storage/db-app-db";

export type EdgeMoneyBatchCodeStats = {
  codeCount: number;
  /** Сумма use_count по кодам партии (регистрации по этим кодам). */
  registrationsTotal: number;
};

export async function aggregateEdgeMoneyBatchCodeStats(
  db: AppDb,
  batchId: string,
): Promise<EdgeMoneyBatchCodeStats> {
  const [row] = await db
    .select({
      codeCount: sql<number>`count(*)::int`,
      registrationsTotal: sql<number>`coalesce(sum(${referralCodes.useCount}), 0)::int`,
    })
    .from(referralCodes)
    .where(eq(referralCodes.edgeMoneyInviteBatchId, batchId));
  return {
    codeCount: Number(row?.codeCount ?? 0) || 0,
    registrationsTotal: Number(row?.registrationsTotal ?? 0) || 0,
  };
}
