import { eq, and, desc, or, ilike, sql, ne, isNull, inArray, exists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { User, InsertUser } from "@shared/schema";
import { users, chats, chatMembers, contacts } from "@shared/schema";
import { ensureUserColumns } from "../db";
import { normalizePhone } from "../auth/phone";
import { isPhoneAtRestEnabled, phoneLookupHash } from "../auth/phone-at-rest";
import { escapeSqlLikeUserSearch } from "./db-storage-user-like-escape";
import { userSearchConditionsFromPhones } from "./db-storage-user-phone-search";
import { STORAGE_INITIAL_PUBLIC_ID } from "./storage-constants";
import type { AppDb } from "./db-app-db";

export async function dbStorageGetUser(db: AppDb, id: string): Promise<User | undefined> {
  await ensureUserColumns();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function dbStorageGetUserByPhone(db: AppDb, phone: string): Promise<User | undefined> {
  await ensureUserColumns();
  if (phone === "admin") {
    const [legacyRow] = await db.select().from(users).where(eq(users.phone, "admin")).limit(1);
    if (legacyRow) return legacyRow;
    if (isPhoneAtRestEnabled()) {
      try {
        const adminHash = phoneLookupHash("admin");
        const [byHash] = await db.select().from(users).where(eq(users.phoneLookupHash, adminHash)).limit(1);
        if (byHash) return byHash;
      } catch {
        /* секрет не задан между проверкой и запросом */
      }
    }
    return undefined;
  }
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  if (isPhoneAtRestEnabled()) {
    try {
      const h = phoneLookupHash(normalized);
      const [byHash] = await db.select().from(users).where(eq(users.phoneLookupHash, h)).limit(1);
      if (byHash) return byHash;
    } catch {
      /* секрет не задан между проверкой и запросом */
    }
  }
  const [legacy] = await db.select().from(users).where(eq(users.phone, normalized)).limit(1);
  return legacy;
}

export async function dbStorageFindUsersDiscoverableByPhones(
  db: AppDb,
  phones: string[],
  excludeUserId: string,
): Promise<User[]> {
  await ensureUserColumns();
  const unique = [...new Set(phones)].filter(Boolean);
  if (unique.length === 0) return [];
  const matchClauses = [inArray(users.phone, unique)];
  if (isPhoneAtRestEnabled()) {
    try {
      const hashes = unique.map((p) => phoneLookupHash(p));
      matchClauses.push(inArray(users.phoneLookupHash, hashes));
    } catch {
      /* */
    }
  }
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        or(...matchClauses),
        isNull(users.deletedAt),
        eq(users.isBlocked, false),
        eq(users.hideFromSearch, false),
        ne(users.id, excludeUserId),
      ),
    );
  return rows;
}

export async function dbStorageSearchUsers(db: AppDb, query: string, excludeUserId: string): Promise<User[]> {
  const q = query.trim();
  if (!q) return [];
  const safeLike = `%${escapeSqlLikeUserSearch(q)}%`;
  const conditions = [
    ilike(users.displayName, safeLike),
    ilike(users.surname, safeLike),
    ilike(sql<string>`TRIM(COALESCE(${users.displayName}, '') || ' ' || COALESCE(${users.surname}, ''))`, safeLike),
  ];
  const nickQ = q.replace(/^@+/u, "").trim();
  if (nickQ.length > 0) {
    conditions.push(ilike(users.nickname, `%${escapeSqlLikeUserSearch(nickQ)}%`));
  }
  if (/^\d+$/u.test(q)) {
    const pubId = parseInt(q, 10);
    if (!Number.isNaN(pubId) && pubId >= 0 && pubId <= 2147483647) {
      conditions.push(eq(users.publicId, pubId));
    }
  }
  conditions.push(...userSearchConditionsFromPhones(q));
  const viewerId = excludeUserId;
  const dmMemberSelf = alias(chatMembers, "search_dm_self");
  const dmMemberPeer = alias(chatMembers, "search_dm_peer");
  const discoverableDespiteHideFromSearch = or(
    eq(users.hideFromSearch, false),
    exists(
      db
        .select({ one: sql`1` })
        .from(contacts)
        .where(and(eq(contacts.userId, viewerId), eq(contacts.contactUserId, users.id))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(contacts)
        .where(and(eq(contacts.userId, users.id), eq(contacts.contactUserId, viewerId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(dmMemberSelf)
        .innerJoin(dmMemberPeer, eq(dmMemberSelf.chatId, dmMemberPeer.chatId))
        .innerJoin(chats, eq(chats.id, dmMemberSelf.chatId))
        .where(
          and(
            eq(chats.type, "dm"),
            eq(dmMemberSelf.userId, viewerId),
            eq(dmMemberPeer.userId, users.id),
          ),
        ),
    ),
  );
  const baseCond = and(isNull(users.deletedAt), eq(users.isBlocked, false), discoverableDespiteHideFromSearch);
  const rows = await db
    .select()
    .from(users)
    .where(and(baseCond, or(...conditions)))
    .limit(25);
  return rows.filter((u) => u.id !== excludeUserId).slice(0, 20);
}

export async function dbStorageGetNextPublicId(db: AppDb): Promise<number> {
  const [r] = await db
    .select({
      next: sql<number>`GREATEST(COALESCE(MAX(${users.publicId}), ${STORAGE_INITIAL_PUBLIC_ID - 1}), ${STORAGE_INITIAL_PUBLIC_ID - 1}) + 1`,
    })
    .from(users);
  return r?.next ?? STORAGE_INITIAL_PUBLIC_ID;
}

export async function dbStorageCreateUser(db: AppDb, data: InsertUser): Promise<User> {
  const [row] = await db.insert(users).values(data).returning();
  if (!row) throw new Error("Insert user failed");
  return row;
}

export async function dbStorageListUsersRelatedBySignupSignals(
  db: AppDb,
  getUserById: (id: string) => Promise<User | undefined>,
  userId: string,
  opts?: { limit?: number },
): Promise<{
  byDeviceId: User[];
  byIp: User[];
  byUaHash: User[];
  byClientSignalsHash: User[];
}> {
  await ensureUserColumns();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const self = await getUserById(userId);
  if (!self) {
    return { byDeviceId: [], byIp: [], byUaHash: [], byClientSignalsHash: [] };
  }
  const base = and(isNull(users.deletedAt), ne(users.id, userId));

  const byDeviceId = self.signupDeviceId
    ? await db.select().from(users).where(and(base, eq(users.signupDeviceId, self.signupDeviceId))).limit(limit)
    : [];

  const byIp = self.signupIp
    ? await db.select().from(users).where(and(base, eq(users.signupIp, self.signupIp))).limit(limit)
    : [];

  const byUaHash = self.signupUaHash
    ? await db.select().from(users).where(and(base, eq(users.signupUaHash, self.signupUaHash))).limit(limit)
    : [];

  const byClientSignalsHash = self.signupClientSignalsHash
    ? await db
        .select()
        .from(users)
        .where(and(base, eq(users.signupClientSignalsHash, self.signupClientSignalsHash)))
        .limit(limit)
    : [];

  return { byDeviceId, byIp, byUaHash, byClientSignalsHash };
}

export async function dbStorageGetUsersPublicBriefByIds(
  db: AppDb,
  userIds: string[],
): Promise<Record<string, { publicId: number; displayName: string | null; surname: string | null }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const rows = await db
    .select({
      id: users.id,
      publicId: users.publicId,
      displayName: users.displayName,
      surname: users.surname,
    })
    .from(users)
    .where(inArray(users.id, unique));
  const out: Record<string, { publicId: number; displayName: string | null; surname: string | null }> = {};
  for (const r of rows) {
    out[r.id] = {
      publicId: r.publicId,
      displayName: r.displayName ?? null,
      surname: r.surname ?? null,
    };
  }
  return out;
}

export async function dbStorageGetUserByPublicId(db: AppDb, publicId: number): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.publicId, publicId)).limit(1);
  return row;
}

/** Смена пароля (восстановление доступа и т.п.). */
export async function dbStorageSetUserPasswordHash(db: AppDb, userId: string, passwordHash: string): Promise<boolean> {
  await ensureUserColumns();
  const updated = await db.update(users).set({ password: passwordHash }).where(eq(users.id, userId)).returning({ id: users.id });
  return updated.length > 0;
}
