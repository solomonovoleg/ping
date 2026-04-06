import { getDb } from "../../db";
import { tryMarkEdgeMoneyInviteBatchCompleted } from "../complete-batch/try-mark-batch-completed";

/** После успешного consume рефкода — закрыть партию MONEY, если все три слота исчерпаны. */
export async function notifyEdgeMoneyInviteBatchAfterReferralConsumed(batchId: string): Promise<void> {
  try {
    const id = batchId.trim();
    if (!id) return;
    await tryMarkEdgeMoneyInviteBatchCompleted(getDb(), id);
  } catch (e) {
    console.error("[edge-money-invite/after-consume]", e);
  }
}
