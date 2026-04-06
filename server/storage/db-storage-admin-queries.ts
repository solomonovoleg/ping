import { eq, and, asc, desc, sql, isNull, isNotNull, ne } from "drizzle-orm";
import type { Pool } from "pg";
import type { User } from "@shared/schema";
import { users } from "@shared/schema";
import { ensureUserColumns } from "../db";
import { buildSignupRiskSummary, type SignupRiskSummary } from "../admin/signup-risk";
import { buildAdminListUsersSearchOrClause } from "./db-storage-admin-user-search";
import { runDbUserPurgeTransaction } from "./db-storage-purge-user";
import type { AppDb } from "./db-app-db";

export async function dbStorageGetAdminStats(db: AppDb): Promise<{
  total: number;
  blocked: number;
  deleted: number;
  registeredToday: number;
}> {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(isNull(users.deletedAt));
  const [blockedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.isBlocked, true)));
  const [deletedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(isNotNull(users.deletedAt));
  const [todayRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.createdAt} >= current_date`);
  return {
    total: totalRow?.count ?? 0,
    blocked: blockedRow?.count ?? 0,
    deleted: deletedRow?.count ?? 0,
    registeredToday: todayRow?.count ?? 0,
  };
}

/** Подзапрос: сколько пользователей пригласил данный ряд (по invited_by_id). */
const adminListReferralCountExpr = sql`(SELECT COUNT(*)::int FROM users AS rc WHERE rc.invited_by_id = ${users.id})`;

export async function dbStorageListUsersForAdmin(
  db: AppDb,
  opts: {
    limit: number;
    offset: number;
    includeDeleted?: boolean;
    search?: string;
    sort?: "createdAt" | "referrals" | "invitedBy";
    sortDir?: "asc" | "desc";
  },
): Promise<{ users: User[]; total: number }> {
  const cond = opts.includeDeleted ? undefined : isNull(users.deletedAt);
  const search = opts.search?.trim();
  let searchCond = cond;
  if (search) {
    const searchClause = buildAdminListUsersSearchOrClause(search);
    searchCond = searchClause ? (cond ? and(cond, searchClause) : searchClause) : cond;
  }
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(searchCond ?? sql`true`);
  const sort = opts.sort ?? "createdAt";
  const dir = opts.sortDir === "asc" ? asc : desc;
  const primaryOrder =
    sort === "referrals"
      ? dir(adminListReferralCountExpr)
      : sort === "invitedBy"
        ? dir(users.invitedById)
        : dir(users.createdAt);
  const list =
    sort === "createdAt"
      ? await db
          .select()
          .from(users)
          .where(searchCond ?? sql`true`)
          .orderBy(primaryOrder)
          .limit(opts.limit)
          .offset(opts.offset)
      : await db
          .select()
          .from(users)
          .where(searchCond ?? sql`true`)
          .orderBy(primaryOrder, desc(users.createdAt))
          .limit(opts.limit)
          .offset(opts.offset);
  return { users: list, total: totalRow?.count ?? 0 };
}

export async function dbStorageGetAdminUserSignupRiskSummaries(
  pool: Pool,
  userIds: string[],
): Promise<Record<string, SignupRiskSummary>> {
  const out: Record<string, SignupRiskSummary> = {};
  if (userIds.length === 0) return out;
  await ensureUserColumns();
  const { rows } = await pool.query<{
    id: string;
    device_others: number;
    ip_ua_others: number;
  }>(
    `SELECT u.id,
        (SELECT COUNT(*)::int FROM users o
          WHERE o.id <> u.id
          AND o.deleted_at IS NULL
          AND u.signup_device_id IS NOT NULL
          AND o.signup_device_id IS NOT NULL
          AND o.signup_device_id = u.signup_device_id) AS device_others,
        (SELECT COUNT(*)::int FROM users o
          WHERE o.id <> u.id
          AND o.deleted_at IS NULL
          AND u.signup_ip IS NOT NULL
          AND u.signup_ua_hash IS NOT NULL
          AND o.signup_ip IS NOT NULL
          AND o.signup_ua_hash IS NOT NULL
          AND o.signup_ip = u.signup_ip
          AND o.signup_ua_hash = u.signup_ua_hash) AS ip_ua_others
       FROM users u
       WHERE u.id = ANY($1::text[])`,
    [userIds],
  );
  for (const row of rows) {
    out[row.id] = buildSignupRiskSummary(row.device_others ?? 0, row.ip_ua_others ?? 0);
  }
  for (const id of userIds) {
    if (!out[id]) out[id] = buildSignupRiskSummary(0, 0);
  }
  return out;
}

export async function dbStorageSetUserBlocked(
  db: AppDb,
  userId: string,
  blocked: boolean,
  opts?: { bannedBy: string; banReason?: string },
): Promise<User | undefined> {
  const set: Record<string, unknown> = { isBlocked: blocked };
  if (blocked && opts) {
    set.bannedAt = new Date();
    set.bannedBy = opts.bannedBy ?? null;
    set.banReason = opts.banReason ?? null;
  } else if (!blocked) {
    set.bannedAt = null;
    set.bannedBy = null;
    set.banReason = null;
  }
  const [row] = await db
    .update(users)
    .set(set as Record<string, unknown>)
    .where(eq(users.id, userId))
    .returning();
  return row;
}

export async function dbStorageSetUserDeleted(
  db: AppDb,
  userId: string,
  deleted: boolean,
): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set({ deletedAt: deleted ? new Date() : null })
    .where(eq(users.id, userId))
    .returning();
  return row;
}

export async function dbStoragePurgeUserPermanently(pool: Pool, userId: string): Promise<boolean> {
  await ensureUserColumns();
  const client = await pool.connect();
  try {
    return await runDbUserPurgeTransaction(client, userId);
  } finally {
    client.release();
  }
}

export async function dbStorageSetPlatformRole(
  db: AppDb,
  userId: string,
  role: string,
): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set({ platformRole: role })
    .where(eq(users.id, userId))
    .returning();
  return row;
}

export async function dbStorageListAdmins(
  db: AppDb,
): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "platformRole">[]> {
  const list = await db
    .select({
      id: users.id,
      publicId: users.publicId,
      displayName: users.displayName,
      surname: users.surname,
      platformRole: users.platformRole,
    })
    .from(users)
    .where(ne(users.platformRole, "user"));
  return list;
}
