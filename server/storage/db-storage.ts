import { randomUUID } from "crypto";
import { eq, and, desc, asc, sql, gt, gte, lt, lte, or, ilike, isNull, isNotNull, ne, inArray, exists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { IStorage } from "./types";
import type {
  User,
  InsertUser,
  UpdateProfile,
  Chat,
  ChatMember,
  InsertChat,
  InsertChatMember,
  Message,
  InsertMessage,
  ChatVibeState,
  ChatVibeBatch,
  ChatVibeHistoryEntry,
  CallTranscriptSegment,
  UserReminder,
  VoiceTask,
} from "@shared/schema";
import {
  users,
  referralCodes,
  chats,
  chatMembers,
  messages,
  contacts,
  follows,
  userBlocks,
  savedMessages,
  messageHidden,
  tracks,
  trackItems,
  chatFolders,
  chatMemberPrefs,
  scheduledMessages,
  chatVibeState,
  chatVibeBatches,
  chatVibeHistory,
  callSessionsHistory,
  callParticipantsHistory,
  callTranscriptSegments,
  callCommandSuggestions,
  callTrackItems,
  userReminders,
  voiceTasks,
  dmScheduledCalls,
} from "@shared/schema";
import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";
import { getDb, getPool, ensureUserColumns } from "../db";
import { normalizePhone, normalizedPhonesFromSearchQuery } from "../auth/phone";
import { isPhoneAtRestEnabled, phoneLookupHash } from "../auth/phone-at-rest";

const PUBLIC_ID_START = 241095;

/** Таблица/колонки user_blocks ещё не накатили — не роняем ленту и профиль. */
function isUserBlocksSchemaUnavailable(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
      ? String((err as { message: string }).message)
      : "";
  const aboutBlocks = /user_blocks/i.test(msg) || /restrict_profile/i.test(msg) || /restrict_chat/i.test(msg);
  if (code === "42P01" && aboutBlocks) return true;
  if (code === "42703" && aboutBlocks) return true;
  return /user_blocks/i.test(msg) && /does not exist/i.test(msg);
}

export class DbStorage implements IStorage {
  private db = getDb();

  async getUser(id: string): Promise<User | undefined> {
    await ensureUserColumns();
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    await ensureUserColumns();
    if (phone === "admin") {
      const [row] = await this.db.select().from(users).where(eq(users.phone, "admin")).limit(1);
      return row;
    }
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    if (isPhoneAtRestEnabled()) {
      try {
        const h = phoneLookupHash(normalized);
        const [byHash] = await this.db.select().from(users).where(eq(users.phoneLookupHash, h)).limit(1);
        if (byHash) return byHash;
      } catch {
        /* секрет не задан между проверкой и запросом */
      }
    }
    const [legacy] = await this.db.select().from(users).where(eq(users.phone, normalized)).limit(1);
    return legacy;
  }

  async findUsersDiscoverableByPhones(phones: string[], excludeUserId: string): Promise<User[]> {
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
    const rows = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(...matchClauses),
          isNull(users.deletedAt),
          eq(users.isBlocked, false),
          eq(users.hideFromSearch, false),
          ne(users.id, excludeUserId)
        )
      );
    return rows;
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const q = query.trim();
    if (!q) return [];
    const escapeLike = (s: string) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const safeLike = `%${escapeLike(q)}%`;
    const conditions = [
      ilike(users.displayName, safeLike),
      ilike(users.surname, safeLike),
      ilike(sql<string>`TRIM(COALESCE(${users.displayName}, '') || ' ' || COALESCE(${users.surname}, ''))`, safeLike),
    ];
    const nickQ = q.replace(/^@+/u, "").trim();
    if (nickQ.length > 0) {
      conditions.push(ilike(users.nickname, `%${escapeLike(nickQ)}%`));
    }
    if (/^\d+$/u.test(q)) {
      const pubId = parseInt(q, 10);
      if (!Number.isNaN(pubId) && pubId >= 0 && pubId <= 2147483647) {
        conditions.push(eq(users.publicId, pubId));
      }
    }
    for (const normalized of normalizedPhonesFromSearchQuery(q)) {
      conditions.push(eq(users.phone, normalized));
      if (isPhoneAtRestEnabled()) {
        try {
          conditions.push(eq(users.phoneLookupHash, phoneLookupHash(normalized)));
        } catch {
          /* */
        }
      }
    }
    const viewerId = excludeUserId;
    const dmMemberSelf = alias(chatMembers, "search_dm_self");
    const dmMemberPeer = alias(chatMembers, "search_dm_peer");
    /** Скрытие из поиска не должно выкидывать тех, с кем уже есть связь (как в комментарии к hide_from_search в схеме). */
    const discoverableDespiteHideFromSearch = or(
      eq(users.hideFromSearch, false),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(contacts)
          .where(and(eq(contacts.userId, viewerId), eq(contacts.contactUserId, users.id))),
      ),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(contacts)
          .where(and(eq(contacts.userId, users.id), eq(contacts.contactUserId, viewerId))),
      ),
      exists(
        this.db
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
    const rows = await this.db
      .select()
      .from(users)
      .where(and(baseCond, or(...conditions)))
      .limit(25);
    return rows.filter((u) => u.id !== excludeUserId).slice(0, 20);
  }

  async getNextPublicId(): Promise<number> {
    const [r] = await this.db
      .select({
        next: sql<number>`GREATEST(COALESCE(MAX(${users.publicId}), ${PUBLIC_ID_START - 1}), ${PUBLIC_ID_START - 1}) + 1`,
      })
      .from(users);
    return r?.next ?? PUBLIC_ID_START;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [row] = await this.db.insert(users).values(data).returning();
    if (!row) throw new Error("Insert user failed");
    return row;
  }

  async getAdminStats(): Promise<{ total: number; blocked: number; deleted: number; registeredToday: number }> {
    const base = this.db.select().from(users);
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.deletedAt));
    const [blockedRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.isBlocked, true)));
    const [deletedRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(isNotNull(users.deletedAt));
    const [todayRow] = await this.db
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

  async listUsersForAdmin(opts: {
    limit: number;
    offset: number;
    includeDeleted?: boolean;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const cond = opts.includeDeleted ? undefined : isNull(users.deletedAt);
    const search = opts.search?.trim();
    let searchCond = cond;
    if (search) {
      const like = `%${search}%`;
      const trimmed = search.trim();
      const clauses = [
        ilike(users.displayName, like),
        ilike(users.surname, like),
        ilike(users.nickname, like),
      ];
      if (/^\d+$/u.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        if (!Number.isNaN(num) && num >= 0 && num <= 2147483647) clauses.push(eq(users.publicId, num));
      }
      for (const np of normalizedPhonesFromSearchQuery(search)) {
        clauses.push(eq(users.phone, np));
        if (isPhoneAtRestEnabled()) {
          try {
            clauses.push(eq(users.phoneLookupHash, phoneLookupHash(np)));
          } catch {
            /* */
          }
        }
      }
      const searchClause = or(...clauses);
      searchCond = searchClause ? (cond ? and(cond, searchClause) : searchClause) : cond;
    }
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(searchCond ?? sql`true`);
    const list = await this.db
      .select()
      .from(users)
      .where(searchCond ?? sql`true`)
      .orderBy(desc(users.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);
    return { users: list, total: totalRow?.count ?? 0 };
  }

  async setUserBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }): Promise<User | undefined> {
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
    const [row] = await this.db
      .update(users)
      .set(set as Record<string, unknown>)
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async setUserDeleted(userId: string, deleted: boolean): Promise<User | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ deletedAt: deleted ? new Date() : null })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async setPlatformRole(userId: string, role: string): Promise<User | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ platformRole: role })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async listAdmins(): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "platformRole">[]> {
    const list = await this.db
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

  async createReferralCode(
    inviterUserId: string,
    code: string,
    expiresAt: Date,
    opts?: { maxUses?: number; bypassInviterLimit?: boolean }
  ): Promise<{ id: string; code: string; expiresAt: Date; maxUses: number }> {
    const id = randomUUID();
    let maxUses = opts?.maxUses ?? 1;
    if (maxUses === 0 || maxUses < -1) maxUses = 1;
    if (maxUses > 10_000) maxUses = 10_000;
    await this.db.insert(referralCodes).values({
      id,
      code,
      inviterUserId,
      expiresAt,
      maxUses,
      useCount: 0,
      bypassInviterLimit: opts?.bypassInviterLimit === true,
    });
    return { id, code, expiresAt, maxUses };
  }

  async getReferralCodeByCode(
    code: string,
  ): Promise<
    { id: string; inviterUserId: string; expiresAt: Date; bypassInviterLimit: boolean } | undefined
  > {
    const now = new Date();
    const usable = or(
      and(eq(referralCodes.maxUses, 1), isNull(referralCodes.usedAt)),
      eq(referralCodes.maxUses, -1),
      and(gt(referralCodes.maxUses, 1), sql`${referralCodes.useCount} < ${referralCodes.maxUses}`)
    );
    const [row] = await this.db
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

  /** Атомарно списывает одно использование; false — гонка или код уже недействителен */
  async consumeReferralCode(codeId: string): Promise<boolean> {
    const stillValid = or(
      and(eq(referralCodes.maxUses, 1), isNull(referralCodes.usedAt)),
      eq(referralCodes.maxUses, -1),
      and(gt(referralCodes.maxUses, 1), sql`${referralCodes.useCount} < ${referralCodes.maxUses}`)
    );
    const rows = await this.db
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

  async countReferralsByInviter(inviterUserId: string): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.invitedById, inviterUserId));
    return r?.count ?? 0;
  }

  async listActiveReferralCodesByInviter(
    inviterUserId: string
  ): Promise<{ id: string; code: string; expiresAt: Date; maxUses: number; useCount: number }[]> {
    const now = new Date();
    const usable = or(
      and(eq(referralCodes.maxUses, 1), isNull(referralCodes.usedAt)),
      eq(referralCodes.maxUses, -1),
      and(gt(referralCodes.maxUses, 1), sql`${referralCodes.useCount} < ${referralCodes.maxUses}`)
    );
    return this.db
      .select({
        id: referralCodes.id,
        code: referralCodes.code,
        expiresAt: referralCodes.expiresAt,
        maxUses: referralCodes.maxUses,
        useCount: referralCodes.useCount,
      })
      .from(referralCodes)
      .where(and(eq(referralCodes.inviterUserId, inviterUserId), gt(referralCodes.expiresAt, now), usable))
      .orderBy(desc(referralCodes.expiresAt));
  }

  async getUserRegistrationsByDay(days: number): Promise<{ day: string; count: number }[]> {
    const safeDays = Math.min(Math.max(1, Math.floor(days)), 90);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (safeDays - 1));

    const rows = await this.db
      .select({
        day: sql<string>`to_char((${users.createdAt} AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), gte(users.createdAt, start)))
      .groupBy(sql`(${users.createdAt} AT TIME ZONE 'UTC')::date`)
      .orderBy(asc(sql`(${users.createdAt} AT TIME ZONE 'UTC')::date`));

    const map = new Map(rows.map((r) => [r.day, r.count]));
    const out: { day: string; count: number }[] = [];
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, count: map.get(key) ?? 0 });
    }
    return out;
  }

  async listInvitedUsers(inviterUserId: string): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "avatarUrl" | "createdAt">[]> {
    return this.db
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

  async getReferralCountsForUserIds(userIds: string[]): Promise<Record<string, number>> {
    if (userIds.length === 0) return {};
    const rows = await this.db
      .select({ invitedById: users.invitedById, count: sql<number>`count(*)::int` })
      .from(users)
      .where(inArray(users.invitedById, userIds))
      .groupBy(users.invitedById);
    const out: Record<string, number> = {};
    for (const id of userIds) out[id] = 0;
    for (const r of rows) if (r.invitedById) out[r.invitedById] = r.count;
    return out;
  }

  async getChatById(id: string): Promise<Chat | undefined> {
    const [row] = await this.db.select().from(chats).where(eq(chats.id, id)).limit(1);
    return row;
  }

  async getChatMember(chatId: string, userId: string): Promise<ChatMember | undefined> {
    const [row] = await this.db
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);
    return row;
  }

  async getChatMemberIds(chatId: string): Promise<string[]> {
    const rows = await this.db.select({ userId: chatMembers.userId }).from(chatMembers).where(eq(chatMembers.chatId, chatId));
    return rows.map((r) => r.userId);
  }

  async getChatsForUser(userId: string): Promise<Chat[]> {
    const rows = await this.db
      .select({ chat: chats })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .where(eq(chatMembers.userId, userId))
      .orderBy(desc(chats.createdAt));
    return rows.map((r) => r.chat);
  }

  async getChatMemberPrefsForUser(
    userId: string
  ): Promise<Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>> {
    try {
      const rows = await this.db.select().from(chatMemberPrefs).where(eq(chatMemberPrefs.userId, userId));
      const m = new Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>();
      for (const r of rows) {
        m.set(r.chatId, {
          pinnedAt: r.pinnedAt ?? null,
          hiddenAt: r.hiddenAt ?? null,
          listSection: r.listSection ?? "general",
        });
      }
      return m;
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "42P01") {
        console.warn(
          "[db] Таблица chat_member_prefs отсутствует — выполните миграции (scripts/migrate-chat-member-prefs.cjs / деплой). Список чатов без закреплений/скрытых.",
        );
        return new Map();
      }
      throw err;
    }
  }

  async upsertChatMemberPrefs(
    userId: string,
    chatId: string,
    patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string }
  ): Promise<void> {
    const [row] = await this.db
      .select()
      .from(chatMemberPrefs)
      .where(and(eq(chatMemberPrefs.chatId, chatId), eq(chatMemberPrefs.userId, userId)))
      .limit(1);
    const merged = {
      chatId,
      userId,
      pinnedAt: patch.pinnedAt !== undefined ? patch.pinnedAt : row?.pinnedAt ?? null,
      hiddenAt: patch.hiddenAt !== undefined ? patch.hiddenAt : row?.hiddenAt ?? null,
      listSection: patch.listSection !== undefined ? patch.listSection : row?.listSection ?? "general",
      updatedAt: new Date(),
    };
    await this.db
      .insert(chatMemberPrefs)
      .values(merged)
      .onConflictDoUpdate({
        target: [chatMemberPrefs.chatId, chatMemberPrefs.userId],
        set: {
          pinnedAt: merged.pinnedAt,
          hiddenAt: merged.hiddenAt,
          listSection: merged.listSection,
          updatedAt: merged.updatedAt,
        },
      });
  }

  async deleteChatCascade(chatId: string): Promise<boolean> {
    const del = await this.db.delete(chats).where(eq(chats.id, chatId)).returning({ id: chats.id });
    return del.length > 0;
  }

  async deleteChatMemberPrefs(userId: string, chatId: string): Promise<void> {
    await this.db
      .delete(chatMemberPrefs)
      .where(and(eq(chatMemberPrefs.chatId, chatId), eq(chatMemberPrefs.userId, userId)));
  }

  async getOrCreateDmChat(userId: string, otherUserId: string): Promise<Chat> {
    const findStrictSql = `
      SELECT c.id
      FROM chats c
      INNER JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = $1
      INNER JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = $2
      WHERE c.type = 'dm'
        AND (SELECT COUNT(*)::int FROM chat_members cm WHERE cm.chat_id = c.id) = 2
      LIMIT 1
    `;
    const findLooseSql = `
      SELECT c.id, (SELECT COUNT(*)::int FROM chat_members cm WHERE cm.chat_id = c.id) AS mc
      FROM chats c
      INNER JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = $1
      INNER JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = $2
      WHERE c.type = 'dm'
      ORDER BY mc ASC, c.created_at DESC
      LIMIT 1
    `;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let existingId: string | undefined;
      const strict = await client.query<{ id: string }>(findStrictSql, [userId, otherUserId]);
      existingId = strict.rows[0]?.id;
      if (!existingId) {
        const loose = await client.query<{ id: string; mc: string | number }>(findLooseSql, [userId, otherUserId]);
        const row = loose.rows[0];
        const mc = row ? Number(row.mc) : 0;
        if (row && mc === 2) {
          existingId = row.id;
        }
      }
      if (existingId) {
        await client.query("COMMIT");
        const chat = await this.getChatById(existingId);
        if (chat) return chat;
      }

      const ins = await client.query<Chat>(
        `INSERT INTO chats (type, name) VALUES ('dm', NULL)
         RETURNING id, type, name, avatar_url, created_at`,
      );
      const chat = ins.rows[0];
      if (!chat) throw new Error("Create chat failed");
      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'admin'), ($1, $3, 'member')`,
        [chat.id, userId, otherUserId],
      );
      await client.query("COMMIT");
      return chat;
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async createChat(data: InsertChat): Promise<Chat> {
    const [row] = await this.db.insert(chats).values(data).returning();
    if (!row) throw new Error("Insert chat failed");
    return row;
  }

  async addChatMember(data: InsertChatMember): Promise<ChatMember> {
    const [row] = await this.db.insert(chatMembers).values(data).returning();
    if (!row) throw new Error("Insert chat member failed");
    return row;
  }

  async removeChatMember(chatId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async updateChat(chatId: string, data: { name?: string; avatarUrl?: string }): Promise<Chat | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;
    if (Object.keys(updates).length === 0) return this.getChatById(chatId);
    const [row] = await this.db.update(chats).set(updates).where(eq(chats.id, chatId)).returning();
    return row;
  }

  async updateLastRead(chatId: string, userId: string, readUpTo?: Date): Promise<void> {
    if (!readUpTo) return;
    const newAt = readUpTo;
    const [member] = await this.db
      .select({ lastReadAt: chatMembers.lastReadAt })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);
    const current = member?.lastReadAt;
    const at = !current || newAt > current ? newAt : current;
    await this.db
      .update(chatMembers)
      .set({ lastReadAt: at })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
  }

  async updateLastReadByMessageId(chatId: string, userId: string, messageId: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE chat_members
      SET last_read_at = GREATEST(
        COALESCE(last_read_at, '1970-01-01'::timestamptz),
        COALESCE(
          (SELECT created_at FROM messages WHERE id = ${messageId} AND chat_id = ${chatId}),
          last_read_at
        )
      )
      WHERE chat_id = ${chatId} AND user_id = ${userId}
    `);
  }

  async getChatMemberLastReadAt(chatId: string, userId: string): Promise<Date | null> {
    const [m] = await this.db
      .select({ lastReadAt: chatMembers.lastReadAt })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);
    return m?.lastReadAt ?? null;
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const [member] = await this.db
      .select({ lastReadAt: chatMembers.lastReadAt })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);
    const since = member?.lastReadAt ?? null;
    const fromOthers = or(ne(messages.senderId, userId), isNull(messages.senderId));
    const unreadEligible = and(ne(messages.type, "system"), ne(messages.type, "missed_call"));
    if (!since) {
      const [r] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), fromOthers, unreadEligible));
      return r?.count ?? 0;
    }
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), gt(messages.createdAt, since), fromOthers, unreadEligible));
    return r?.count ?? 0;
  }

  async getUnreadCountByFolder(chatId: string, folderId: string | null, userId: string): Promise<number> {
    const [member] = await this.db
      .select({ lastReadAt: chatMembers.lastReadAt })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);
    const since = member?.lastReadAt ?? null;
    const fromOthers = or(ne(messages.senderId, userId), isNull(messages.senderId));
    const unreadEligible = and(ne(messages.type, "system"), ne(messages.type, "missed_call"));
    const folderCond = folderId == null ? isNull(messages.folderId) : eq(messages.folderId, folderId);
    if (!since) {
      const [r] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), folderCond, fromOthers, unreadEligible));
      return r?.count ?? 0;
    }
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), folderCond, gt(messages.createdAt, since), fromOthers, unreadEligible));
    return r?.count ?? 0;
  }

  async getMessageCountByFolder(chatId: string, folderId: string): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.folderId, folderId)));
    return r?.count ?? 0;
  }

  async getMessagesByChatId(chatId: string, limit = 100, beforeMessageId?: string, folderId?: string | null): Promise<Message[]> {
    const conditions = [eq(messages.chatId, chatId)];
    if (folderId != null) {
      conditions.push(eq(messages.folderId, folderId));
    } else {
      conditions.push(isNull(messages.folderId));
    }
    if (beforeMessageId) {
      const [beforeMsg] = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), eq(messages.id, beforeMessageId)))
        .limit(1);
      if (beforeMsg) conditions.push(lt(messages.createdAt, beforeMsg.createdAt));
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(limit, 200));
    return rows.reverse() as Message[];
  }

  async getMediaMessages(chatId: string, folderId: string | null, limit: number, beforeMessageId?: string): Promise<Message[]> {
    const conditions = [
      eq(messages.chatId, chatId),
      inArray(messages.type, ["image", "video", "voice", "video_note"]),
    ];
    if (folderId != null) conditions.push(eq(messages.folderId, folderId));
    else conditions.push(isNull(messages.folderId));
    if (beforeMessageId) {
      const [beforeMsg] = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), eq(messages.id, beforeMessageId)))
        .limit(1);
      if (beforeMsg) conditions.push(lt(messages.createdAt, beforeMsg.createdAt));
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(limit, 100));
    return rows.reverse() as Message[];
  }

  async getTextMessagesForLinks(chatId: string, folderId: string | null, limit: number, beforeMessageId?: string): Promise<Pick<Message, "id" | "content" | "createdAt">[]> {
    const conditions = [eq(messages.chatId, chatId), eq(messages.type, "text")];
    if (folderId != null) conditions.push(eq(messages.folderId, folderId));
    else conditions.push(isNull(messages.folderId));
    if (beforeMessageId) {
      const [beforeMsg] = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), eq(messages.id, beforeMessageId)))
        .limit(1);
      if (beforeMsg) conditions.push(lt(messages.createdAt, beforeMsg.createdAt));
    }
    const rows = await this.db
      .select({ id: messages.id, content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(limit, 200));
    return rows.reverse() as Pick<Message, "id" | "content" | "createdAt">[];
  }

  async listChatFolders(chatId: string): Promise<import("@shared/schema").ChatFolder[]> {
    const rows = await this.db
      .select()
      .from(chatFolders)
      .where(eq(chatFolders.chatId, chatId))
      .orderBy(asc(chatFolders.orderIndex), asc(chatFolders.createdAt));
    return rows as import("@shared/schema").ChatFolder[];
  }

  async getOrCreateMainFolder(chatId: string): Promise<import("@shared/schema").ChatFolder> {
    const [existing] = await this.db
      .select()
      .from(chatFolders)
      .where(and(eq(chatFolders.chatId, chatId), eq(chatFolders.isMain, true)))
      .limit(1);
    if (existing) return existing as import("@shared/schema").ChatFolder;
    const [row] = await this.db
      .insert(chatFolders)
      .values({ chatId, name: "Общий", isMain: true, orderIndex: 0 })
      .returning();
    if (!row) throw new Error("Create main folder failed");
    return row as import("@shared/schema").ChatFolder;
  }

  async createChatFolder(chatId: string, name: string, orderIndex: number): Promise<import("@shared/schema").ChatFolder> {
    const [row] = await this.db
      .insert(chatFolders)
      .values({ chatId, name: name.trim(), isMain: false, orderIndex })
      .returning();
    if (!row) throw new Error("Create folder failed");
    return row as import("@shared/schema").ChatFolder;
  }

  async getChatFolder(folderId: string): Promise<import("@shared/schema").ChatFolder | undefined> {
    const [row] = await this.db.select().from(chatFolders).where(eq(chatFolders.id, folderId)).limit(1);
    return row as import("@shared/schema").ChatFolder | undefined;
  }

  async updateChatFolder(folderId: string, data: { name?: string }): Promise<import("@shared/schema").ChatFolder | undefined> {
    if (!data.name?.trim()) return this.getChatFolder(folderId);
    const [row] = await this.db
      .update(chatFolders)
      .set({ name: data.name.trim() })
      .where(eq(chatFolders.id, folderId))
      .returning();
    return row as import("@shared/schema").ChatFolder | undefined;
  }

  async deleteChatFolder(folderId: string): Promise<boolean> {
    const [folder] = await this.db.select().from(chatFolders).where(eq(chatFolders.id, folderId)).limit(1);
    if (!folder || folder.isMain) return false;
    const r = await this.db.delete(chatFolders).where(eq(chatFolders.id, folderId));
    return (r.rowCount ?? 0) > 0;
  }

  async getLastMessage(chatId: string): Promise<Message | undefined> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    return row as Message | undefined;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const result = await this.db.insert(messages).values(data).returning();
    const rows = Array.isArray(result) ? result : [];
    const [row] = rows;
    if (!row) throw new Error("Insert message failed");
    return row as Message;
  }

  async getMessage(chatId: string, messageId: string): Promise<Message | undefined> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .limit(1);
    return row as Message | undefined;
  }

  async deleteMessage(chatId: string, messageId: string): Promise<boolean> {
    const r = await this.db
      .delete(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)));
    return (r.rowCount ?? 0) > 0;
  }

  async updateMessage(chatId: string, messageId: string, content: string): Promise<Message | undefined> {
    const [row] = await this.db
      .update(messages)
      .set({ content: content.trim() })
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .returning();
    return row as Message | undefined;
  }

  async updateMessageTranscript(chatId: string, messageId: string, transcript: string): Promise<Message | undefined> {
    const t = transcript.trim();
    const [row] = await this.db
      .update(messages)
      .set({ transcript: t || null })
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .returning();
    return row as Message | undefined;
  }

  async addMessageHidden(userId: string, chatId: string, messageId: string): Promise<void> {
    await this.db
      .insert(messageHidden)
      .values({ userId, chatId, messageId })
      .onConflictDoNothing({ target: [messageHidden.userId, messageHidden.chatId, messageHidden.messageId] });
  }

  async getHiddenMessageIdsForUserInChat(userId: string, chatId: string): Promise<string[]> {
    const rows = await this.db
      .select({ messageId: messageHidden.messageId })
      .from(messageHidden)
      .where(and(eq(messageHidden.userId, userId), eq(messageHidden.chatId, chatId)));
    return rows.map((r) => r.messageId);
  }

  async createScheduledMessage(data: {
    chatId: string;
    folderId?: string | null;
    senderId: string;
    type: string;
    content: string;
    replyToId?: string | null;
    scheduledAt: Date;
  }): Promise<{ id: string; scheduledAt: Date }> {
    const [row] = await this.db
      .insert(scheduledMessages)
      .values({
        chatId: data.chatId,
        folderId: data.folderId ?? undefined,
        senderId: data.senderId,
        type: data.type,
        content: data.content,
        replyToId: data.replyToId ?? undefined,
        scheduledAt: data.scheduledAt,
      })
      .returning({ id: scheduledMessages.id, scheduledAt: scheduledMessages.scheduledAt });
    if (!row) throw new Error("Insert scheduled message failed");
    return row as { id: string; scheduledAt: Date };
  }

  async getScheduledMessagesDue(limit: number): Promise<
    { id: string; chatId: string; folderId: string | null; senderId: string | null; type: string; content: string; replyToId: string | null }[]
  > {
    const now = new Date();
    const rows = await this.db
      .select({
        id: scheduledMessages.id,
        chatId: scheduledMessages.chatId,
        folderId: scheduledMessages.folderId,
        senderId: scheduledMessages.senderId,
        type: scheduledMessages.type,
        content: scheduledMessages.content,
        replyToId: scheduledMessages.replyToId,
      })
      .from(scheduledMessages)
      .where(lte(scheduledMessages.scheduledAt, now))
      .limit(limit);
    return rows as { id: string; chatId: string; folderId: string | null; senderId: string | null; type: string; content: string; replyToId: string | null }[];
  }

  async deleteScheduledMessage(id: string): Promise<boolean> {
    const r = await this.db.delete(scheduledMessages).where(eq(scheduledMessages.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async searchMessages(
    userId: string,
    query: string,
    limit: number
  ): Promise<{ messageId: string; chatId: string; type: string; content: string; createdAt: Date; chatName: string }[]> {
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    const rows = await this.db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        type: messages.type,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(chatMembers, eq(chatMembers.chatId, messages.chatId))
      .where(and(eq(chatMembers.userId, userId), ilike(messages.content, like)))
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(limit, 50));
    const chatNames = new Map<string, string>();
    for (const row of rows) {
      if (chatNames.has(row.chatId)) continue;
      const chat = await this.getChatById(row.chatId);
      if (!chat) {
        chatNames.set(row.chatId, "Чат");
        continue;
      }
      if (chat.type === "dm") {
        const memberIds = await this.getChatMemberIds(chat.id);
        const otherId = memberIds.find((id) => id !== userId);
        const other = otherId ? await this.getUser(otherId) : null;
        chatNames.set(
          row.chatId,
          other ? [other.displayName, other.surname].filter(Boolean).join(" ").trim() || `ID ${other.publicId}` : "Диалог"
        );
      } else {
        chatNames.set(row.chatId, chat.name || "Группа");
      }
    }
    return rows.map((r) => ({
      messageId: r.id,
      chatId: r.chatId,
      type: r.type,
      content: r.content.slice(0, 200),
      createdAt: r.createdAt,
      chatName: chatNames.get(r.chatId) || "Чат",
    }));
  }

  async saveMessage(userId: string, messageId: string, chatId: string): Promise<void> {
    await this.db
      .insert(savedMessages)
      .values({ userId, messageId, chatId })
      .onConflictDoNothing();
  }

  async unsaveMessage(userId: string, messageId: string): Promise<void> {
    await this.db
      .delete(savedMessages)
      .where(and(eq(savedMessages.userId, userId), eq(savedMessages.messageId, messageId)));
  }

  async listSavedMessages(
    userId: string,
    limit: number,
    offset: number
  ): Promise<
    {
      messageId: string;
      chatId: string;
      savedAt: Date;
      content: string;
      type: string;
      chatName: string;
    }[]
  > {
    const rows = await this.db
      .select({
        messageId: savedMessages.messageId,
        chatId: savedMessages.chatId,
        savedAt: savedMessages.savedAt,
        content: messages.content,
        type: messages.type,
      })
      .from(savedMessages)
      .innerJoin(messages, eq(messages.id, savedMessages.messageId))
      .where(eq(savedMessages.userId, userId))
      .orderBy(desc(savedMessages.savedAt))
      .limit(limit)
      .offset(offset);
    const chatNames = new Map<string, string>();
    for (const row of rows) {
      if (chatNames.has(row.chatId)) continue;
      const chat = await this.getChatById(row.chatId);
      if (!chat) {
        chatNames.set(row.chatId, "Чат");
        continue;
      }
      if (chat.type === "dm") {
        const memberIds = await this.getChatMemberIds(chat.id);
        const otherId = memberIds.find((id) => id !== userId);
        const other = otherId ? await this.getUser(otherId) : null;
        chatNames.set(
          row.chatId,
          other ? [other.displayName, other.surname].filter(Boolean).join(" ").trim() || `ID ${other.publicId}` : "Диалог"
        );
      } else {
        chatNames.set(row.chatId, chat.name || "Группа");
      }
    }
    return rows.map((r) => ({
      messageId: r.messageId,
      chatId: r.chatId,
      savedAt: r.savedAt,
      content: r.type === "text" ? r.content.slice(0, 150) : r.type,
      type: r.type,
      chatName: chatNames.get(r.chatId) || "Чат",
    }));
  }

  async isMessageSaved(userId: string, messageId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ messageId: savedMessages.messageId })
      .from(savedMessages)
      .where(and(eq(savedMessages.userId, userId), eq(savedMessages.messageId, messageId)))
      .limit(1);
    return !!row;
  }

  async createTrack(userId: string, name: string): Promise<{ id: string; name: string; createdAt: Date }> {
    const [row] = await this.db.insert(tracks).values({ userId, name: name.trim() || "Новый трек" }).returning();
    if (!row) throw new Error("Create track failed");
    return { id: row.id, name: row.name, createdAt: row.createdAt };
  }

  async listTracks(userId: string): Promise<{ id: string; name: string; createdAt: Date; totalItems: number; activeItems: number; doneItems: number }[]> {
    const trackRows = await this.db
      .select({ id: tracks.id, name: tracks.name, createdAt: tracks.createdAt })
      .from(tracks)
      .where(eq(tracks.userId, userId))
      .orderBy(desc(tracks.createdAt));
    const messageCounts = await this.db
      .select({
        trackId: trackItems.trackId,
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${trackItems.doneAt} is null)::int`,
        done: sql<number>`count(*) filter (where ${trackItems.doneAt} is not null)::int`,
      })
      .from(trackItems)
      .groupBy(trackItems.trackId);
    const callCounts = await this.db
      .select({
        trackId: callTrackItems.trackId,
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${callTrackItems.doneAt} is null)::int`,
        done: sql<number>`count(*) filter (where ${callTrackItems.doneAt} is not null)::int`,
      })
      .from(callTrackItems)
      .groupBy(callTrackItems.trackId);
    const countMap = new Map<string, { total: number; active: number; done: number }>();
    for (const c of messageCounts) countMap.set(c.trackId, { total: c.total, active: c.active, done: c.done });
    for (const c of callCounts) {
      const prev = countMap.get(c.trackId) ?? { total: 0, active: 0, done: 0 };
      countMap.set(c.trackId, {
        total: prev.total + c.total,
        active: prev.active + c.active,
        done: prev.done + c.done,
      });
    }
    return trackRows.map((t) => {
      const c = countMap.get(t.id) ?? { total: 0, active: 0, done: 0 };
      return { ...t, totalItems: c.total, activeItems: c.active, doneItems: c.done };
    });
  }

  async getTrack(userId: string, trackId: string): Promise<{ id: string; name: string; createdAt: Date } | undefined> {
    const [row] = await this.db
      .select({ id: tracks.id, name: tracks.name, createdAt: tracks.createdAt })
      .from(tracks)
      .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)))
      .limit(1);
    return row;
  }

  async addMessageToTrack(userId: string, trackId: string, messageId: string, chatId: string): Promise<void> {
    const track = await this.getTrack(userId, trackId);
    if (!track) throw new Error("Трек не найден");
    const memberIds = await this.getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) throw new Error("Нет доступа к чату");
    const msg = await this.getMessage(chatId, messageId);
    if (!msg) throw new Error("Сообщение не найдено");
    await this.db
      .insert(trackItems)
      .values({ trackId, messageId, chatId })
      .onConflictDoNothing({ target: [trackItems.trackId, trackItems.messageId] });
  }

  async addCallSegmentToTrack(userId: string, trackId: string, segmentId: string): Promise<void> {
    const track = await this.getTrack(userId, trackId);
    if (!track) throw new Error("Трек не найден");
    const [row] = await this.db
      .select({
        segmentId: callTranscriptSegments.id,
        callId: callTranscriptSegments.callId,
        speakerUserId: callTranscriptSegments.speakerUserId,
        speakerDisplayName: callTranscriptSegments.speakerDisplayName,
        text: callTranscriptSegments.textNormalized,
      })
      .from(callTranscriptSegments)
      .innerJoin(callParticipantsHistory, eq(callParticipantsHistory.callId, callTranscriptSegments.callId))
      .where(and(eq(callTranscriptSegments.id, segmentId), eq(callParticipantsHistory.userId, userId)))
      .limit(1);
    if (!row) throw new Error("Реплика не найдена");
    await this.db
      .insert(callTrackItems)
      .values({
        trackId,
        callId: row.callId,
        segmentId: row.segmentId,
        speakerUserId: row.speakerUserId,
        speakerDisplayName: row.speakerDisplayName,
        text: row.text,
      })
      .onConflictDoNothing({ target: [callTrackItems.trackId, callTrackItems.segmentId] });
  }

  async removeTrackItem(userId: string, trackId: string, itemId: string): Promise<void> {
    const track = await this.getTrack(userId, trackId);
    if (!track) throw new Error("Трек не найден");
    const [item] = await this.db
      .select()
      .from(trackItems)
      .where(and(eq(trackItems.trackId, trackId), eq(trackItems.id, itemId)))
      .limit(1);
    if (item) {
      await this.db.delete(trackItems).where(eq(trackItems.id, itemId));
      return;
    }
    const [callItem] = await this.db
      .select()
      .from(callTrackItems)
      .where(and(eq(callTrackItems.trackId, trackId), eq(callTrackItems.id, itemId)))
      .limit(1);
    if (!callItem) throw new Error("Элемент не найден");
    await this.db.delete(callTrackItems).where(eq(callTrackItems.id, itemId));
  }

  async setTrackItemDone(userId: string, trackId: string, itemId: string, done: boolean): Promise<void> {
    const track = await this.getTrack(userId, trackId);
    if (!track) throw new Error("Трек не найден");
    const [item] = await this.db
      .select()
      .from(trackItems)
      .where(and(eq(trackItems.trackId, trackId), eq(trackItems.id, itemId)))
      .limit(1);
    if (item) {
      await this.db
        .update(trackItems)
        .set({ doneAt: done ? new Date() : null })
        .where(eq(trackItems.id, itemId));
      return;
    }
    const [callItem] = await this.db
      .select()
      .from(callTrackItems)
      .where(and(eq(callTrackItems.trackId, trackId), eq(callTrackItems.id, itemId)))
      .limit(1);
    if (!callItem) throw new Error("Элемент не найден");
    await this.db
      .update(callTrackItems)
      .set({ doneAt: done ? new Date() : null })
      .where(eq(callTrackItems.id, itemId));
  }

  async updateTrack(userId: string, trackId: string, data: { name: string }): Promise<void> {
    const track = await this.getTrack(userId, trackId);
    if (!track) throw new Error("Трек не найден");
    await this.db
      .update(tracks)
      .set({ name: data.name.trim() || track.name })
      .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
  }

  async deleteTrack(userId: string, trackId: string): Promise<void> {
    const track = await this.getTrack(userId, trackId);
    if (!track) throw new Error("Трек не найден");
    await this.db.delete(tracks).where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
  }

  async getTracksStats(userId: string): Promise<{ totalTracks: number; activeItemsCount: number; doneItemsCount: number; lastAddedAt: Date | null }> {
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tracks)
      .where(eq(tracks.userId, userId));
    const [activeRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackItems)
      .innerJoin(tracks, eq(tracks.id, trackItems.trackId))
      .where(and(eq(tracks.userId, userId), isNull(trackItems.doneAt)));
    const [doneRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackItems)
      .innerJoin(tracks, eq(tracks.id, trackItems.trackId))
      .where(and(eq(tracks.userId, userId), isNotNull(trackItems.doneAt)));
    const [lastRow] = await this.db
      .select({ lastAdded: sql<Date>`max(${trackItems.addedAt})` })
      .from(trackItems)
      .innerJoin(tracks, eq(tracks.id, trackItems.trackId))
      .where(eq(tracks.userId, userId));
    const [activeCallRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(callTrackItems)
      .innerJoin(tracks, eq(tracks.id, callTrackItems.trackId))
      .where(and(eq(tracks.userId, userId), isNull(callTrackItems.doneAt)));
    const [doneCallRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(callTrackItems)
      .innerJoin(tracks, eq(tracks.id, callTrackItems.trackId))
      .where(and(eq(tracks.userId, userId), isNotNull(callTrackItems.doneAt)));
    const [lastCallRow] = await this.db
      .select({ lastAdded: sql<Date>`max(${callTrackItems.addedAt})` })
      .from(callTrackItems)
      .innerJoin(tracks, eq(tracks.id, callTrackItems.trackId))
      .where(eq(tracks.userId, userId));
    const candidates = [lastRow?.lastAdded ?? null, lastCallRow?.lastAdded ?? null].filter(Boolean) as Date[];
    return {
      totalTracks: totalRow?.count ?? 0,
      activeItemsCount: (activeRow?.count ?? 0) + (activeCallRow?.count ?? 0),
      doneItemsCount: (doneRow?.count ?? 0) + (doneCallRow?.count ?? 0),
      lastAddedAt: candidates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    };
  }

  async listTrackItems(
    userId: string,
    trackId: string
  ): Promise<
    {
      id: string;
      sourceType: "message" | "call_segment";
      messageId: string | null;
      chatId: string | null;
      callId: string | null;
      chatName: string;
      speakerDisplayName: string | null;
      content: string;
      type: string;
      messageCreatedAt: Date;
      addedAt: Date;
      doneAt: Date | null;
    }[]
  > {
    const track = await this.getTrack(userId, trackId);
    if (!track) return [];
    const rows = await this.db
      .select({
        id: trackItems.id,
        messageId: trackItems.messageId,
        chatId: trackItems.chatId,
        content: messages.content,
        type: messages.type,
        messageCreatedAt: messages.createdAt,
        addedAt: trackItems.addedAt,
        doneAt: trackItems.doneAt,
      })
      .from(trackItems)
      .innerJoin(messages, eq(messages.id, trackItems.messageId))
      .where(eq(trackItems.trackId, trackId))
      .orderBy(desc(trackItems.addedAt));
    const callRows = await this.db
      .select({
        id: callTrackItems.id,
        callId: callTrackItems.callId,
        speakerDisplayName: callTrackItems.speakerDisplayName,
        content: callTrackItems.text,
        createdAt: callTranscriptSegments.createdAt,
        addedAt: callTrackItems.addedAt,
        doneAt: callTrackItems.doneAt,
        chatId: callSessionsHistory.chatId,
      })
      .from(callTrackItems)
      .innerJoin(callTranscriptSegments, eq(callTranscriptSegments.id, callTrackItems.segmentId))
      .innerJoin(callSessionsHistory, eq(callSessionsHistory.id, callTrackItems.callId))
      .where(eq(callTrackItems.trackId, trackId))
      .orderBy(desc(callTrackItems.addedAt));
    const chatNames = new Map<string, string>();
    for (const row of rows) {
      if (chatNames.has(row.chatId)) continue;
      const chat = await this.getChatById(row.chatId);
      if (!chat) {
        chatNames.set(row.chatId, "Чат");
        continue;
      }
      if (chat.type === "dm") {
        const memberIds = await this.getChatMemberIds(chat.id);
        const otherId = memberIds.find((id) => id !== userId);
        const other = otherId ? await this.getUser(otherId) : null;
        chatNames.set(
          row.chatId,
          other ? [other.displayName, other.surname].filter(Boolean).join(" ").trim() || `ID ${other.publicId}` : "Диалог"
        );
      } else {
        chatNames.set(row.chatId, chat.name || "Группа");
      }
    }
    for (const row of callRows) {
      if (chatNames.has(row.chatId)) continue;
      const chat = await this.getChatById(row.chatId);
      chatNames.set(row.chatId, chat?.name || "Созвон");
    }
    const messageItems = rows.map((r) => ({
      id: r.id,
      sourceType: "message" as const,
      messageId: r.messageId,
      chatId: r.chatId,
      callId: null,
      chatName: chatNames.get(r.chatId) || "Чат",
      speakerDisplayName: null,
      content: r.type === "text" ? r.content.slice(0, 200) : r.type,
      type: r.type,
      messageCreatedAt: r.messageCreatedAt,
      addedAt: r.addedAt,
      doneAt: r.doneAt,
    }));
    const segmentItems = callRows.map((r) => ({
      id: r.id,
      sourceType: "call_segment" as const,
      messageId: null,
      chatId: null,
      callId: r.callId,
      chatName: `Созвон · ${chatNames.get(r.chatId) || "Чат"}`,
      speakerDisplayName: r.speakerDisplayName,
      content: r.content,
      type: "call_segment",
      messageCreatedAt: r.createdAt,
      addedAt: r.addedAt,
      doneAt: r.doneAt,
    }));
    return [...messageItems, ...segmentItems].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  }

  async createCallSessionHistory(data: {
    id: string;
    chatId: string;
    mediaType: "audio" | "video";
    createdByUserId: string;
  }) {
    const [row] = await this.db
      .insert(callSessionsHistory)
      .values(data)
      .onConflictDoNothing({ target: [callSessionsHistory.id] })
      .returning();
    return row ?? (await this.db.select().from(callSessionsHistory).where(eq(callSessionsHistory.id, data.id)).limit(1))[0]!;
  }

  async endCallSessionHistory(callId: string): Promise<void> {
    await this.db
      .update(callSessionsHistory)
      .set({ endedAt: new Date() })
      .where(and(eq(callSessionsHistory.id, callId), isNull(callSessionsHistory.endedAt)));
  }

  async upsertCallParticipantHistory(callId: string, userId: string, displayNameSnapshot: string) {
    const [row] = await this.db
      .insert(callParticipantsHistory)
      .values({ callId, userId, displayNameSnapshot, leftAt: null })
      .onConflictDoUpdate({
        target: [callParticipantsHistory.callId, callParticipantsHistory.userId],
        set: { displayNameSnapshot, leftAt: null },
      })
      .returning();
    return row;
  }

  async markCallParticipantLeft(callId: string, userId: string): Promise<void> {
    await this.db
      .update(callParticipantsHistory)
      .set({ leftAt: new Date() })
      .where(and(eq(callParticipantsHistory.callId, callId), eq(callParticipantsHistory.userId, userId)));
  }

  async upsertCallTranscriptSegment(data: {
    id: string;
    callId: string;
    speakerUserId: string;
    speakerDisplayName: string;
    sourceStreamId?: string | null;
    language?: string;
    textRaw: string;
    textNormalized: string;
    confidence: number;
    startedAtMs: number;
    endedAtMs: number;
    isFinal: boolean;
  }): Promise<CallTranscriptSegment> {
    const [row] = await this.db
      .insert(callTranscriptSegments)
      .values({
        ...data,
        sourceStreamId: data.sourceStreamId ?? null,
        language: data.language ?? "ru-RU",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [callTranscriptSegments.id],
        set: {
          speakerDisplayName: data.speakerDisplayName,
          sourceStreamId: data.sourceStreamId ?? null,
          language: data.language ?? "ru-RU",
          textRaw: data.textRaw,
          textNormalized: data.textNormalized,
          confidence: data.confidence,
          startedAtMs: data.startedAtMs,
          endedAtMs: data.endedAtMs,
          isFinal: data.isFinal,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getCallTranscriptSegment(callId: string, segmentId: string): Promise<CallTranscriptSegment | undefined> {
    const [row] = await this.db
      .select()
      .from(callTranscriptSegments)
      .where(and(eq(callTranscriptSegments.callId, callId), eq(callTranscriptSegments.id, segmentId)))
      .limit(1);
    return row;
  }

  async listCallTranscriptSegments(userId: string, callId: string): Promise<CallTranscriptSegment[]> {
    const [participant] = await this.db
      .select({ id: callParticipantsHistory.id })
      .from(callParticipantsHistory)
      .where(and(eq(callParticipantsHistory.callId, callId), eq(callParticipantsHistory.userId, userId)))
      .limit(1);
    if (!participant) return [];
    return this.db
      .select()
      .from(callTranscriptSegments)
      .where(eq(callTranscriptSegments.callId, callId))
      .orderBy(asc(callTranscriptSegments.createdAt));
  }

  async listCallSessionsHistory(userId: string): Promise<Array<typeof callSessionsHistory.$inferSelect & { participantCount: number; chatName: string }>> {
    const rows = await this.db
      .select({
        id: callSessionsHistory.id,
        chatId: callSessionsHistory.chatId,
        mediaType: callSessionsHistory.mediaType,
        createdByUserId: callSessionsHistory.createdByUserId,
        createdAt: callSessionsHistory.createdAt,
        endedAt: callSessionsHistory.endedAt,
      })
      .from(callSessionsHistory)
      .innerJoin(callParticipantsHistory, eq(callParticipantsHistory.callId, callSessionsHistory.id))
      .where(eq(callParticipantsHistory.userId, userId))
      .orderBy(desc(callSessionsHistory.createdAt));
    const participantCounts = await this.db
      .select({
        callId: callParticipantsHistory.callId,
        count: sql<number>`count(*)::int`,
      })
      .from(callParticipantsHistory)
      .groupBy(callParticipantsHistory.callId);
    const countMap = new Map(participantCounts.map((r) => [r.callId, r.count]));
    const chatMap = new Map<string, string>();
    for (const row of rows) {
      if (chatMap.has(row.chatId)) continue;
      const chat = await this.getChatById(row.chatId);
      chatMap.set(row.chatId, chat?.name || "Созвон");
    }
    return rows.map((row) => ({ ...row, participantCount: countMap.get(row.id) ?? 0, chatName: chatMap.get(row.chatId) || "Созвон" }));
  }

  async createCallCommandSuggestion(data: {
    callId: string;
    segmentId?: string | null;
    intentType: string;
    title: string;
    payloadJson: string;
  }) {
    const [row] = await this.db
      .insert(callCommandSuggestions)
      .values(data)
      .onConflictDoNothing({ target: [callCommandSuggestions.segmentId, callCommandSuggestions.intentType] })
      .returning();
    return row ?? (await this.db.select().from(callCommandSuggestions)
      .where(and(eq(callCommandSuggestions.segmentId, data.segmentId ?? ""), eq(callCommandSuggestions.intentType, data.intentType)))
      .limit(1))[0]!;
  }

  async listCallCommandSuggestions(userId: string, callId: string) {
    const [participant] = await this.db
      .select({ id: callParticipantsHistory.id })
      .from(callParticipantsHistory)
      .where(and(eq(callParticipantsHistory.callId, callId), eq(callParticipantsHistory.userId, userId)))
      .limit(1);
    if (!participant) return [];
    return this.db
      .select()
      .from(callCommandSuggestions)
      .where(eq(callCommandSuggestions.callId, callId))
      .orderBy(desc(callCommandSuggestions.createdAt));
  }

  async resolveCallCommandSuggestion(
    userId: string,
    callId: string,
    suggestionId: string,
    status: "accepted" | "dismissed",
  ): Promise<void> {
    await this.db
      .update(callCommandSuggestions)
      .set({ status, resolvedAt: new Date(), resolvedByUserId: userId })
      .where(and(eq(callCommandSuggestions.id, suggestionId), eq(callCommandSuggestions.callId, callId)));
  }

  async updateUserProfile(userId: string, data: UpdateProfile): Promise<User | undefined> {
    const update: Record<string, unknown> = {};
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.surname !== undefined) update.surname = data.surname;
    if (data.nickname !== undefined) update.nickname = data.nickname;
    if (data.gender !== undefined) update.gender = data.gender;
    if (data.birthDate !== undefined) update.birthDate = data.birthDate;
    if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;
    if (data.hideFromSearch !== undefined) update.hideFromSearch = data.hideFromSearch;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.coverUrl !== undefined) update.coverUrl = data.coverUrl;
    if (data.showCover !== undefined) update.showCover = data.showCover;
    if (data.profileLink !== undefined) update.profileLink = data.profileLink;
    if (data.city !== undefined) update.city = data.city;
    if (data.status !== undefined) update.status = data.status;
    if (data.pinnedPostId !== undefined) update.pinnedPostId = data.pinnedPostId;
    if (data.profileVisibility !== undefined) update.profileVisibility = data.profileVisibility;
    if (data.dmPolicy !== undefined) update.dmPolicy = data.dmPolicy;
    if (data.groupAddMePolicy !== undefined) update.groupAddMePolicy = data.groupAddMePolicy;
    if (data.showOnlineTo !== undefined) update.showOnlineTo = data.showOnlineTo;
    if (data.pushEnabled !== undefined) update.pushEnabled = data.pushEnabled;
    if (data.vibeEnabled !== undefined) update.vibeEnabled = data.vibeEnabled;
    if (data.vibeShareWithPartner !== undefined) update.vibeShareWithPartner = data.vibeShareWithPartner;
    if ((data as { referralLimit?: number | null }).referralLimit !== undefined) {
      const v = (data as { referralLimit?: number | null }).referralLimit;
      update.referralLimit = v == null ? null : v;
    }
    if (Object.keys(update).length === 0) return this.getUser(userId);
    const [row] = await this.db.update(users).set(update).where(eq(users.id, userId)).returning();
    return row;
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    await this.db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserFcmToken(userId: string, token: string | null): Promise<void> {
    await this.db.update(users).set({ fcmToken: token }).where(eq(users.id, userId));
  }

  async isContact(ownerId: string, contactUserId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.userId, ownerId), eq(contacts.contactUserId, contactUserId)))
      .limit(1);
    return !!row;
  }

  async addContact(ownerId: string, contactUserId: string): Promise<void> {
    const existing = await this.isContact(ownerId, contactUserId);
    if (existing) return;
    await this.db.insert(contacts).values({ userId: ownerId, contactUserId });
  }

  async listContactUserIds(ownerId: string): Promise<string[]> {
    const rows = await this.db
      .select({ contactUserId: contacts.contactUserId })
      .from(contacts)
      .where(eq(contacts.userId, ownerId));
    return rows.map((r) => r.contactUserId);
  }

  async addFollow(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) return false;
    const existing = await this.isFollowing(followerId, followingId);
    if (existing) return false;
    await this.db.insert(follows).values({ followerId, followingId });
    return true;
  }

  async removeFollow(followerId: string, followingId: string): Promise<void> {
    await this.db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .limit(1);
    return !!row;
  }

  async listFollowingIds(followerId: string): Promise<string[]> {
    const rows = await this.db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, followerId));
    return rows.map((r) => r.followingId);
  }

  async listFollowerIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(eq(follows.followingId, userId));
    return rows.map((r) => r.followerId);
  }

  async getFollowersCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId));
    return row?.count ?? 0;
  }

  async getFollowingCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId));
    return row?.count ?? 0;
  }

  async getFollowersList(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    const rows = await this.db
      .select({
        id: users.id,
        publicId: users.publicId,
        displayName: users.displayName,
        surname: users.surname,
        avatarUrl: users.avatarUrl,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);
    return rows;
  }

  async getFollowingList(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    const rows = await this.db
      .select({
        id: users.id,
        publicId: users.publicId,
        displayName: users.displayName,
        surname: users.surname,
        avatarUrl: users.avatarUrl,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);
    return rows;
  }

  async countMutualFollowingWhoFollowTarget(viewerId: string, targetUserId: string): Promise<number> {
    const fViewer = follows;
    const fMutual = alias(follows, "follows_mutual_to_target");
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(fViewer)
      .innerJoin(fMutual, eq(fViewer.followingId, fMutual.followerId))
      .innerJoin(users, eq(users.id, fViewer.followingId))
      .where(
        and(
          eq(fViewer.followerId, viewerId),
          eq(fMutual.followingId, targetUserId),
          isNull(users.deletedAt),
          eq(users.isBlocked, false)
        )
      );
    return row?.count ?? 0;
  }

  async listMutualFollowingWhoFollowTarget(
    viewerId: string,
    targetUserId: string,
    limit: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    const fViewer = follows;
    const fMutual = alias(follows, "follows_mutual_to_target");
    const rows = await this.db
      .select({
        id: users.id,
        publicId: users.publicId,
        displayName: users.displayName,
        surname: users.surname,
        avatarUrl: users.avatarUrl,
      })
      .from(fViewer)
      .innerJoin(fMutual, eq(fViewer.followingId, fMutual.followerId))
      .innerJoin(users, eq(users.id, fViewer.followingId))
      .where(
        and(
          eq(fViewer.followerId, viewerId),
          eq(fMutual.followingId, targetUserId),
          isNull(users.deletedAt),
          eq(users.isBlocked, false)
        )
      )
      .orderBy(desc(fMutual.createdAt))
      .limit(Math.min(Math.max(limit, 1), 20));
    return rows;
  }

  async getUserByPublicId(publicId: number): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.publicId, publicId)).limit(1);
    return row;
  }

  async addBlock(
    blockerId: string,
    blockedId: string,
    flags?: Partial<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean }>,
    blockNote?: string | null,
  ): Promise<void> {
    if (blockerId === blockedId) return;
    const restrictProfile = flags?.restrictProfile !== false;
    const restrictChat = flags?.restrictChat !== false;
    const restrictSocial = flags?.restrictSocial !== false;
    const noteOnInsert = blockNote === undefined ? null : blockNote;
    await this.db
      .insert(userBlocks)
      .values({ blockerId, blockedId, restrictProfile, restrictChat, restrictSocial, blockNote: noteOnInsert })
      .onConflictDoUpdate({
        target: [userBlocks.blockerId, userBlocks.blockedId],
        set: {
          restrictProfile,
          restrictChat,
          restrictSocial,
          ...(blockNote !== undefined ? { blockNote } : {}),
        },
      });
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    await this.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);
    return !!row;
  }

  async getBlockFlags(
    blockerId: string,
    blockedId: string,
  ): Promise<{
    restrictProfile: boolean;
    restrictChat: boolean;
    restrictSocial: boolean;
    blockNote: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        restrictProfile: userBlocks.restrictProfile,
        restrictChat: userBlocks.restrictChat,
        restrictSocial: userBlocks.restrictSocial,
        blockNote: userBlocks.blockNote,
      })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);
    if (!row) return null;
    return {
      restrictProfile: row.restrictProfile === true,
      restrictChat: row.restrictChat === true,
      restrictSocial: row.restrictSocial === true,
      blockNote: row.blockNote && String(row.blockNote).trim() ? String(row.blockNote).trim() : null,
    };
  }

  async getBlockedRelationIds(viewerId: string): Promise<string[]> {
    try {
      const fullBlock = and(
        eq(userBlocks.restrictProfile, true),
        eq(userBlocks.restrictChat, true),
        eq(userBlocks.restrictSocial, true),
      );
      const asBlocker = await this.db
        .select({ blockedId: userBlocks.blockedId })
        .from(userBlocks)
        .where(and(eq(userBlocks.blockerId, viewerId), fullBlock));
      const asBlocked = await this.db
        .select({ blockerId: userBlocks.blockerId })
        .from(userBlocks)
        .where(and(eq(userBlocks.blockedId, viewerId), fullBlock));
      const set = new Set<string>();
      asBlocker.forEach((r) => set.add(r.blockedId));
      asBlocked.forEach((r) => set.add(r.blockerId));
      return Array.from(set);
    } catch (err: unknown) {
      if (isUserBlocksSchemaUnavailable(err)) {
        console.warn(
          "[db] user_blocks недоступна — лента без фильтра полных блокировок до миграции user_block_restrictions.",
        );
        return [];
      }
      throw err;
    }
  }

  // ── Chat Vibe ──────────────────────────────────────────────

  async getVibeState(chatId: string): Promise<ChatVibeState | undefined> {
    const [row] = await this.db
      .select()
      .from(chatVibeState)
      .where(eq(chatVibeState.chatId, chatId))
      .limit(1);
    return row;
  }

  async upsertVibeState(
    chatId: string,
    data: {
      theme: VibeThemeCode;
      confidence: number;
      axes: VibeAxes;
      messageCounter: number;
      themeVersion?: number;
      touchLastBatchAt?: boolean;
    }
  ): Promise<ChatVibeState> {
    const now = new Date();
    const touchBatch = data.touchLastBatchAt === true;
    const insertValues = {
      chatId,
      theme: data.theme,
      confidence: String(data.confidence),
      warmth: data.axes.warmth,
      tension: data.axes.tension,
      playfulness: data.axes.playfulness,
      intimacy: data.axes.intimacy,
      formality: data.axes.formality,
      energy: data.axes.energy,
      messageCounter: data.messageCounter,
      ...(data.themeVersion !== undefined && { themeVersion: data.themeVersion }),
      lastBatchAt: touchBatch ? now : null,
      updatedAt: now,
    };
    const updateSet: Record<string, unknown> = {
      theme: data.theme,
      confidence: String(data.confidence),
      warmth: data.axes.warmth,
      tension: data.axes.tension,
      playfulness: data.axes.playfulness,
      intimacy: data.axes.intimacy,
      formality: data.axes.formality,
      energy: data.axes.energy,
      messageCounter: data.messageCounter,
      updatedAt: now,
    };
    if (data.themeVersion !== undefined) updateSet.themeVersion = data.themeVersion;
    if (touchBatch) updateSet.lastBatchAt = now;

    const [row] = await this.db
      .insert(chatVibeState)
      .values(insertValues)
      .onConflictDoUpdate({
        target: chatVibeState.chatId,
        set: updateSet as typeof insertValues,
      })
      .returning();
    return row;
  }

  async createVibeBatch(data: {
    chatId: string;
    windowSize: number;
    dominantPattern: VibeThemeCode;
    secondaryPattern?: VibeThemeCode;
    confidence: number;
    axes: VibeAxes;
    toxicityFlag?: boolean;
  }): Promise<ChatVibeBatch> {
    const [row] = await this.db
      .insert(chatVibeBatches)
      .values({
        chatId: data.chatId,
        windowSize: data.windowSize,
        dominantPattern: data.dominantPattern,
        secondaryPattern: data.secondaryPattern ?? null,
        confidence: String(data.confidence),
        warmth: data.axes.warmth,
        tension: data.axes.tension,
        playfulness: data.axes.playfulness,
        intimacy: data.axes.intimacy,
        formality: data.axes.formality,
        energy: data.axes.energy,
        toxicityFlag: data.toxicityFlag ?? false,
      })
      .returning();
    return row;
  }

  async getRecentVibeBatches(chatId: string, limit: number): Promise<ChatVibeBatch[]> {
    return this.db
      .select()
      .from(chatVibeBatches)
      .where(eq(chatVibeBatches.chatId, chatId))
      .orderBy(desc(chatVibeBatches.createdAt))
      .limit(limit);
  }

  async createVibeHistoryEntry(data: {
    chatId: string;
    oldTheme: string;
    newTheme: string;
    oldConfidence: number;
    newConfidence: number;
    triggerType: string;
  }): Promise<ChatVibeHistoryEntry> {
    const [row] = await this.db
      .insert(chatVibeHistory)
      .values({
        chatId: data.chatId,
        oldTheme: data.oldTheme,
        newTheme: data.newTheme,
        oldConfidence: String(data.oldConfidence),
        newConfidence: String(data.newConfidence),
        triggerType: data.triggerType,
      })
      .returning();
    return row;
  }

  async createUserReminder(data: { userId: string; title: string; fireAt: Date }): Promise<UserReminder> {
    const [row] = await this.db
      .insert(userReminders)
      .values({
        userId: data.userId,
        title: data.title.trim() || "Напоминание",
        fireAt: data.fireAt,
      })
      .returning();
    return row;
  }

  async listDueUserReminders(userId: string, before: Date): Promise<UserReminder[]> {
    return this.db
      .select()
      .from(userReminders)
      .where(
        and(
          eq(userReminders.userId, userId),
          isNull(userReminders.dismissedAt),
          lte(userReminders.fireAt, before),
        ),
      )
      .orderBy(asc(userReminders.fireAt))
      .limit(50);
  }

  async dismissUserReminder(userId: string, id: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(userReminders)
      .set({ dismissedAt: now })
      .where(and(eq(userReminders.id, id), eq(userReminders.userId, userId), isNull(userReminders.dismissedAt)))
      .returning({ id: userReminders.id });
    return rows.length > 0;
  }

  async updateUserReminderFireAt(userId: string, id: string, fireAt: Date): Promise<boolean> {
    const rows = await this.db
      .update(userReminders)
      .set({ fireAt })
      .where(and(eq(userReminders.id, id), eq(userReminders.userId, userId), isNull(userReminders.dismissedAt)))
      .returning({ id: userReminders.id });
    return rows.length > 0;
  }

  async createVoiceTask(data: { userId: string; title: string }): Promise<VoiceTask> {
    const [row] = await this.db
      .insert(voiceTasks)
      .values({
        userId: data.userId,
        title: data.title.trim() || "Задача",
      })
      .returning();
    return row;
  }

  async listOpenVoiceTasks(userId: string, limit: number): Promise<VoiceTask[]> {
    return this.db
      .select()
      .from(voiceTasks)
      .where(and(eq(voiceTasks.userId, userId), isNull(voiceTasks.doneAt)))
      .orderBy(desc(voiceTasks.createdAt))
      .limit(Math.min(100, Math.max(1, limit)));
  }

  async completeVoiceTask(userId: string, id: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(voiceTasks)
      .set({ doneAt: now })
      .where(and(eq(voiceTasks.id, id), eq(voiceTasks.userId, userId), isNull(voiceTasks.doneAt)))
      .returning({ id: voiceTasks.id });
    return rows.length > 0;
  }

  async ensurePingokTrackSourceChat(userId: string): Promise<Chat> {
    const pool = getPool();
    const findSql = `
      SELECT c.id
      FROM chats c
      INNER JOIN chat_members m ON m.chat_id = c.id AND m.user_id = $1
      WHERE c.type = 'group' AND c.name = '__pingok_track_src'
        AND (SELECT COUNT(*)::int FROM chat_members cm WHERE cm.chat_id = c.id) = 1
      LIMIT 1
    `;
    const found = await pool.query<{ id: string }>(findSql, [userId]);
    let chatId = found.rows[0]?.id;
    if (!chatId) {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO chats (type, name) VALUES ('group', '__pingok_track_src') RETURNING id`,
      );
      chatId = ins.rows[0]?.id;
      if (!chatId) throw new Error("Не удалось создать служебный чат для треков");
      await pool.query(`INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'admin')`, [
        chatId,
        userId,
      ]);
    }
    await this.upsertChatMemberPrefs(userId, chatId, { hiddenAt: new Date() });
    const chat = await this.getChatById(chatId);
    if (!chat) throw new Error("Служебный чат треков не найден");
    return chat;
  }

  async findBestUserTrackByName(userId: string, nameQuery: string): Promise<{ id: string; name: string } | null> {
    const q = nameQuery.trim().toLowerCase().replace(/ё/g, "е");
    if (!q) return null;
    const list = await this.listTracks(userId);
    let best: { id: string; name: string; score: number } | null = null;
    for (const t of list) {
      const n = t.name.trim().toLowerCase().replace(/ё/g, "е");
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q)) score = 88;
      else if (n.includes(q)) score = 75;
      else if (q.length >= 4 && n.includes(q.slice(0, Math.max(3, q.length - 1)))) score = 55;
      if (score > 0 && (!best || score > best.score)) best = { id: t.id, name: t.name, score };
    }
    return best ? { id: best.id, name: best.name } : null;
  }

  async createDmScheduledCall(data: {
    chatId: string;
    createdByUserId: string;
    peerUserId: string;
    fireAt: Date;
    title: string;
    plannerReminderId?: string | null;
  }): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(dmScheduledCalls)
      .values({
        chatId: data.chatId,
        createdByUserId: data.createdByUserId,
        peerUserId: data.peerUserId,
        fireAt: data.fireAt,
        title: data.title.trim() || "Звонок",
        plannerReminderId: data.plannerReminderId ?? null,
      })
      .returning({ id: dmScheduledCalls.id });
    if (!row) throw new Error("insert dm_scheduled_calls failed");
    return row;
  }

  async getActiveDmScheduledCallForChatMember(
    userId: string,
    chatId: string,
  ): Promise<{
    id: string;
    fireAt: Date;
    title: string;
    createdByUserId: string;
    peerUserId: string;
    iAmInitiator: boolean;
  } | null> {
    const memberIds = await this.getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) return null;
    const now = Date.now();
    const rows = await this.db
      .select()
      .from(dmScheduledCalls)
      .where(
        and(
          eq(dmScheduledCalls.chatId, chatId),
          or(
            and(eq(dmScheduledCalls.createdByUserId, userId), isNull(dmScheduledCalls.initiatorDismissedAt)),
            and(eq(dmScheduledCalls.peerUserId, userId), isNull(dmScheduledCalls.peerDismissedAt)),
          ),
        ),
      )
      .orderBy(desc(dmScheduledCalls.fireAt))
      .limit(8);
    for (const r of rows) {
      const until = r.fireAt.getTime() + 5 * 60_000;
      if (now > until) continue;
      const iAmInitiator = r.createdByUserId === userId;
      if (iAmInitiator && r.initiatorDismissedAt) continue;
      if (!iAmInitiator && r.peerDismissedAt) continue;
      return {
        id: r.id,
        fireAt: r.fireAt,
        title: r.title,
        createdByUserId: r.createdByUserId,
        peerUserId: r.peerUserId,
        iAmInitiator,
      };
    }
    return null;
  }

  async dismissDmScheduledCallForChatMember(
    userId: string,
    chatId: string,
    rowId: string,
    options: { forBoth: boolean },
  ): Promise<boolean> {
    const memberIds = await this.getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) return false;
    const [row] = await this.db
      .select()
      .from(dmScheduledCalls)
      .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
      .limit(1);
    if (!row) return false;
    const isInitiator = row.createdByUserId === userId;
    const isPeer = row.peerUserId === userId;
    if (!isInitiator && !isPeer) return false;
    const now = new Date();
    if (options.forBoth) {
      const upd = await this.db
        .update(dmScheduledCalls)
        .set({ initiatorDismissedAt: now, peerDismissedAt: now })
        .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
        .returning({ id: dmScheduledCalls.id });
      return upd.length > 0;
    }
    if (isInitiator) {
      const upd = await this.db
        .update(dmScheduledCalls)
        .set({ initiatorDismissedAt: now })
        .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
        .returning({ id: dmScheduledCalls.id });
      return upd.length > 0;
    }
    const upd = await this.db
      .update(dmScheduledCalls)
      .set({ peerDismissedAt: now })
      .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
      .returning({ id: dmScheduledCalls.id });
    return upd.length > 0;
  }

  async listPlannerActiveDmScheduledCalls(userId: string): Promise<
    Array<{
      id: string;
      chatId: string;
      peerUserId: string;
      fireAt: Date;
      title: string;
      plannerReminderId: string | null;
    }>
  > {
    const cutoff = new Date(Date.now() - 2 * 60_000);
    return this.db
      .select({
        id: dmScheduledCalls.id,
        chatId: dmScheduledCalls.chatId,
        peerUserId: dmScheduledCalls.peerUserId,
        fireAt: dmScheduledCalls.fireAt,
        title: dmScheduledCalls.title,
        plannerReminderId: dmScheduledCalls.plannerReminderId,
      })
      .from(dmScheduledCalls)
      .where(
        and(
          eq(dmScheduledCalls.createdByUserId, userId),
          isNull(dmScheduledCalls.initiatorDismissedAt),
          gt(dmScheduledCalls.fireAt, cutoff),
        ),
      )
      .orderBy(asc(dmScheduledCalls.fireAt));
  }

  async updateDmScheduledCallFireAsPlanner(
    userId: string,
    rowId: string,
    fireAt: Date,
    title: string,
  ): Promise<{ chatId: string; peerUserId: string } | null> {
    const [row] = await this.db
      .select()
      .from(dmScheduledCalls)
      .where(
        and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.createdByUserId, userId), isNull(dmScheduledCalls.initiatorDismissedAt)),
      )
      .limit(1);
    if (!row) return null;
    await this.db
      .update(dmScheduledCalls)
      .set({ fireAt, title: title.trim() || row.title })
      .where(eq(dmScheduledCalls.id, rowId));
    if (row.plannerReminderId) {
      await this.updateUserReminderFireAt(userId, row.plannerReminderId, fireAt);
    }
    return { chatId: row.chatId, peerUserId: row.peerUserId };
  }

  async cancelDmScheduledCallAsPlanner(userId: string, rowId: string): Promise<{ chatId: string; peerUserId: string } | null> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(dmScheduledCalls)
      .where(
        and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.createdByUserId, userId), isNull(dmScheduledCalls.initiatorDismissedAt)),
      )
      .limit(1);
    if (!row) return null;
    await this.db
      .update(dmScheduledCalls)
      .set({ initiatorDismissedAt: now, peerDismissedAt: now })
      .where(eq(dmScheduledCalls.id, rowId));
    if (row.plannerReminderId) {
      await this.dismissUserReminder(userId, row.plannerReminderId);
    }
    return { chatId: row.chatId, peerUserId: row.peerUserId };
  }

  async listDmScheduledCallsInPreEventWindow(userId: string): Promise<
    Array<{ id: string; chatId: string; title: string; fireAt: Date }>
  > {
    const now = new Date();
    const until = new Date(now.getTime() + 5 * 60_000);
    const rows = await this.db
      .select({
        id: dmScheduledCalls.id,
        chatId: dmScheduledCalls.chatId,
        title: dmScheduledCalls.title,
        fireAt: dmScheduledCalls.fireAt,
      })
      .from(dmScheduledCalls)
      .where(
        and(
          gt(dmScheduledCalls.fireAt, now),
          lte(dmScheduledCalls.fireAt, until),
          or(
            and(eq(dmScheduledCalls.createdByUserId, userId), isNull(dmScheduledCalls.initiatorDismissedAt)),
            and(eq(dmScheduledCalls.peerUserId, userId), isNull(dmScheduledCalls.peerDismissedAt)),
          ),
        ),
      )
      .orderBy(asc(dmScheduledCalls.fireAt))
      .limit(20);
    return rows;
  }
}
