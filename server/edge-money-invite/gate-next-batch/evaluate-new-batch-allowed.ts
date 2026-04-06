import type { AppDb } from "../../storage/db-app-db";
import { tryMarkEdgeMoneyInviteBatchCompleted } from "../complete-batch/try-mark-batch-completed";
import { selectOpenInviteBatchForUserEdge } from "../select-open-batch/select-open-invite-batch";

export type NewBatchGateResult = {
  allowed: boolean;
  reason?: "pending_invite_codes";
  openBatchId?: string;
};

/**
 * Разрешает создать новую партию кодов только если нет открытой партии с неисчерпанными кодами.
 */
export async function evaluateNewEdgeMoneyInviteBatchAllowed(
  db: AppDb,
  inviterUserId: string,
  edgeId: string,
): Promise<NewBatchGateResult> {
  let open = await selectOpenInviteBatchForUserEdge(db, inviterUserId, edgeId);
  if (!open) return { allowed: true };

  await tryMarkEdgeMoneyInviteBatchCompleted(db, open.id);
  open = await selectOpenInviteBatchForUserEdge(db, inviterUserId, edgeId);
  if (!open) return { allowed: true };

  return { allowed: false, reason: "pending_invite_codes", openBatchId: open.id };
}
