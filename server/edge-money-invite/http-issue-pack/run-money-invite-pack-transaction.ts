import { eq } from "drizzle-orm";
import { edgeMoneyInviteBatches, referralCodes } from "@shared/schema";
import { getDb } from "../../db";
import { generateReferralCode, normalizeReferralCodeInput } from "../../referrals/code-generator";
import { dbStorageCreateReferralCode } from "../../storage/db-storage-referral-queries";
import { storage } from "../../storage";
import type { AppDb } from "../../storage/db-app-db";
import { insertEdgeMoneyInviteBatch } from "../insert-batch/insert-edge-money-invite-batch";

const SLOT_COUNT = 3;

async function createOneUniqueCode(
  db: AppDb,
  inviterUserId: string,
  expiresAt: Date,
  batchId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    let code = generateReferralCode();
    let inner = 0;
    while (inner < 8) {
      const clash = await storage.getReferralCodeByCode(normalizeReferralCodeInput(code));
      if (!clash) break;
      code = generateReferralCode();
      inner += 1;
    }
    try {
      const row = await dbStorageCreateReferralCode(db, inviterUserId, code, expiresAt, {
        maxUses: 1,
        bypassInviterLimit: true,
        edgeMoneyInviteBatchId: batchId,
      });
      return row.code;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate|23505/i.test(msg)) continue;
      throw e;
    }
  }
  throw new Error("Не удалось сгенерировать уникальный код приглашения");
}

/**
 * Партия + ровно три одноразовых кода. При ошибке — откат партии и привязанных кодов.
 */
export async function runMoneyInvitePackTransaction(
  inviterUserId: string,
  edgeId: string,
  expiresAt: Date,
): Promise<{ batchId: string; codes: string[] }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as AppDb;
    const { id: batchId } = await insertEdgeMoneyInviteBatch(tdb, inviterUserId, edgeId, SLOT_COUNT);
    try {
      const codes: string[] = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        codes.push(await createOneUniqueCode(tdb, inviterUserId, expiresAt, batchId));
      }
      return { batchId, codes };
    } catch (e) {
      await tx.delete(referralCodes).where(eq(referralCodes.edgeMoneyInviteBatchId, batchId));
      await tx.delete(edgeMoneyInviteBatches).where(eq(edgeMoneyInviteBatches.id, batchId));
      throw e;
    }
  });
}
