import { randomUUID } from "crypto";
import { eq, and, desc, sql, gt, gte, asc, isNull, inArray } from "drizzle-orm";
import type { User } from "@shared/schema";
import { users, referralCodes } from "@shared/schema";
import { referralCountsByInviter } from "./db-storage-referral-counts-map";
import { referralCodeUsableCondition } from "./db-storage-referral-code-conditions";
import { clampReferralCodeMaxUses, normalizeReferralAdminNote } from "./db-storage-referral-create-helpers";
import { buildUtcRegistrationDaySeries } from "./db-storage-registration-series";
import type { AppDb } from "./db-app-db";

function isMissingReferralBatchIdColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /column/i.test(msg) && /edge_money_invite_batch_id/i.test(msg) && /does not exist/i.test(msg);
}

export async function dbStorageCreateReferralCode(
  db: AppDb,
  inviterUserId: string,
  code: string,
  expiresAt: Date,
  opts?: {
    maxUses?: number;
    bypassInviterLimit?: boolean;
    adminNote?: string;
    edgeMoneyInviteBatchId?: string | null;
  },
): Promise<{ id: string; code: string; expiresAt: Date; maxUses: number; adminNote?: string | null }> {
  const id = randomUUID();
  const maxUses = clampReferralCodeMaxUses(opts?.maxUses);
  const note = normalizeReferralAdminNote(opts?.adminNote);
  const batchId =
    typeof opts?.edgeMoneyInviteBatchId === "string" && opts.edgeMoneyInviteBatchId.trim()
      ? opts.edgeMoneyInviteBatchId.trim()
      : null;
  const values: {
    id: string;
    code: string;
    inviterUserId: string;
    expiresAt: Date;
    maxUses: number;
    useCount: number;
    bypassInviterLimit: boolean;
    adminNote: string | null;
    edgeMoneyInviteBatchId?: string | null;
  } = {
    id,
    code,
    inviterUserId,
    expiresAt,
    maxUses,
    useCount: 0,
    bypassInviterLimit: opts?.bypassInviterLimit === true,
    adminNote: note,
  };
  // Backward-compat for phased deploy: older DB may not yet have this column.
  if (batchId) values.edgeMoneyInviteBatchId = batchId;
  try {
    await db.insert(referralCodes).values(values);
  } catch (err) {
    // Backward-compat for phased deploy: legacy DB may not have edge_money_invite_batch_id yet.
    if (!isMissingReferralBatchIdColumnError(err)) throw err;
    await db.execute(sql`
      INSERT INTO referral_codes
        (id, code, inviter_user_id, expires_at, max_uses, use_count, bypass_inviter_limit, admin_note)
      VALUES
        (${id}, ${code}, ${inviterUserId}, ${expiresAt}, ${maxUses}, ${0}, ${opts?.bypassInviterLimit === true}, ${note})
    `);
  }
  return { id, code, expiresAt, maxUses, adminNote: note };
}

export async function dbStorageGetReferralCodeByCode(
  db: AppDb,
  code: string,
): Promise<
  { id: string; inviterUserId: string; expiresAt: Date; bypassInviterLimit: boolean } | undefined
> {
  const now = new Date();
  const usable = referralCodeUsableCondition();
  const [row] = await db
    .select({
      id: referralCodes.id,
      inviterUserId: referralCodes.inviterUserId,
      expiresAt: referralCodes.expiresAt,
      bypassInviterLimit: referralCodes.bypassInviterLimit,
    })
    .from(referralCodes)
    .where(and(eq(referralCodes.code, code), gt(referralCodes.expiresAt, now), usable))
    .limit(1);
  return row
    ? {
        ...row,
        bypassInviterLimit: row.bypassInviterLimit === true,
      }
    : undefined;
}

export async function dbStorageConsumeReferralCode(db: AppDb, codeId: string): Promise<boolean> {
  const stillValid = referralCodeUsableCondition();
  const rows = await db
    .update(referralCodes)
    .set({
      useCount: sql`${referralCodes.useCount} + 1`,
      usedAt: sql`CASE
          WHEN ${referralCodes.maxUses} = 1 THEN NOW()
          WHEN ${referralCodes.maxUses} > 1 AND ${referralCodes.useCount} + 1 >= ${referralCodes.maxUses} THEN NOW()
          ELSE ${referralCodes.usedAt}
        END`,
    })
    .where(and(eq(referralCodes.id, codeId), sql`${referralCodes.expiresAt} > NOW()`, stillValid))
    .returning({ id: referralCodes.id });
  return rows.length === 1;
}

export async function dbStorageCountReferralsByInviter(db: AppDb, inviterUserId: string): Promise<number> {
  const [r] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.invitedById, inviterUserId));
  return r?.count ?? 0;
}

export async function dbStorageListActiveReferralCodesByInviter(
  db: AppDb,
  inviterUserId: string,
): Promise<
  { id: string; code: string; expiresAt: Date; maxUses: number; useCount: number; adminNote: string | null }[]
> {
  const now = new Date();
  const usable = referralCodeUsableCondition();
  return db
    .select({
      id: referralCodes.id,
      code: referralCodes.code,
      expiresAt: referralCodes.expiresAt,
      maxUses: referralCodes.maxUses,
      useCount: referralCodes.useCount,
      adminNote: referralCodes.adminNote,
    })
    .from(referralCodes)
    .where(and(eq(referralCodes.inviterUserId, inviterUserId), gt(referralCodes.expiresAt, now), usable))
    .orderBy(desc(referralCodes.expiresAt));
}

export async function dbStorageGetUserRegistrationsByDay(
  db: AppDb,
  days: number,
): Promise<{ day: string; count: number }[]> {
  const safeDays = Math.min(Math.max(1, Math.floor(days)), 90);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));

  const rows = await db
    .select({
      day: sql<string>`to_char((${users.createdAt} AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), gte(users.createdAt, start)))
    .groupBy(sql`(${users.createdAt} AT TIME ZONE 'UTC')::date`)
    .orderBy(asc(sql`(${users.createdAt} AT TIME ZONE 'UTC')::date`));

  const map = new Map(rows.map((r) => [r.day, r.count]));
  return buildUtcRegistrationDaySeries(start, safeDays, map);
}

export async function dbStorageListInvitedUsers(
  db: AppDb,
  inviterUserId: string,
): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "avatarUrl" | "createdAt">[]> {
  return db
    .select({
      id: users.id,
      publicId: users.publicId,
      displayName: users.displayName,
      surname: users.surname,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.invitedById, inviterUserId))
    .orderBy(desc(users.createdAt));
}

export async function dbStorageGetReferralCountsForUserIds(
  db: AppDb,
  userIds: string[],
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const rows = await db
    .select({ invitedById: users.invitedById, count: sql<number>`count(*)::int` })
    .from(users)
    .where(inArray(users.invitedById, userIds))
    .groupBy(users.invitedById);
  return referralCountsByInviter(userIds, rows);
}
