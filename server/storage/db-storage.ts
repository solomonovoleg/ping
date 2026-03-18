import { randomUUID } from "crypto";
import { eq, and, desc, sql, gt, lt, or, ilike, isNull, isNotNull, ne, inArray } from "drizzle-orm";
import type { IStorage } from "./types";
import type { User, InsertUser, UpdateProfile, Chat, ChatMember, InsertChat, InsertChatMember, Message, InsertMessage } from "@shared/schema";
import { users, referralCodes, chats, chatMembers, messages, contacts, follows, userBlocks, savedMessages } from "@shared/schema";
import { getDb, ensureUserColumns } from "../db";
import { normalizePhone } from "../auth/phone";

export class DbStorage implements IStorage {
  private db = getDb();

  async getUser(id: string): Promise<User | undefined> {
    await ensureUserColumns();
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    await ensureUserColumns();
    const [row] = await this.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return row;
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const q = query.trim();
    if (!q) return [];
    const escapeLike = (s: string) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const safeLike = `%${escapeLike(q)}%`;
    const conditions = [
      ilike(users.displayName, safeLike),
      ilike(users.surname, safeLike),
    ];
    const normalized = normalizePhone(q);
    if (normalized) conditions.push(eq(users.phone, normalized));
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 1) {
      if (digits.length <= 9) {
        const num = parseInt(digits, 10);
        if (!Number.isNaN(num)) conditions.push(eq(users.publicId, num));
      }
      if (digits.length >= 2) {
        conditions.push(ilike(users.phone, `%${digits}%`));
      }
    }
    const baseCond = and(
      isNull(users.deletedAt),
      eq(users.isBlocked, false),
      eq(users.hideFromSearch, false)
    );
    const rows = await this.db
      .select()
      .from(users)
      .where(and(baseCond, or(...conditions)))
      .limit(25);
    return rows.filter((u) => u.id !== excludeUserId).slice(0, 20);
  }

  async getNextPublicId(): Promise<number> {
    const [r] = await this.db.select({ next: sql<number>`COALESCE(MAX(${users.publicId}), 99) + 1` }).from(users);
    return r?.next ?? 100;
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
      const digitsOnly = search.replace(/\D/g, "");
      const clauses = [
        ilike(users.displayName, like),
        ilike(users.surname, like),
        ilike(users.phone, like),
      ];
      if (digitsOnly.length >= 1 && digitsOnly.length <= 9) {
        const num = parseInt(digitsOnly, 10);
        if (!Number.isNaN(num)) clauses.push(eq(users.publicId, num));
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

  async listAdmins(): Promise<Pick<User, "id" | "publicId" | "phone" | "displayName" | "surname" | "platformRole">[]> {
    const list = await this.db
      .select({
        id: users.id,
        publicId: users.publicId,
        phone: users.phone,
        displayName: users.displayName,
        surname: users.surname,
        platformRole: users.platformRole,
      })
      .from(users)
      .where(ne(users.platformRole, "user"));
    return list;
  }

  async createReferralCode(inviterUserId: string, code: string, expiresAt: Date): Promise<{ id: string; code: string; expiresAt: Date }> {
    const id = randomUUID();
    await this.db.insert(referralCodes).values({
      id,
      code,
      inviterUserId,
      expiresAt,
    });
    return { id, code, expiresAt };
  }

  async getReferralCodeByCode(code: string): Promise<{ id: string; inviterUserId: string; expiresAt: Date } | undefined> {
    const now = new Date();
    const [row] = await this.db
      .select({ id: referralCodes.id, inviterUserId: referralCodes.inviterUserId, expiresAt: referralCodes.expiresAt })
      .from(referralCodes)
      .where(and(eq(referralCodes.code, code), gt(referralCodes.expiresAt, now), isNull(referralCodes.usedAt)))
      .limit(1);
    return row;
  }

  async markReferralCodeUsed(codeId: string): Promise<void> {
    await this.db
      .update(referralCodes)
      .set({ usedAt: new Date() })
      .where(eq(referralCodes.id, codeId));
  }

  async countReferralsByInviter(inviterUserId: string): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.invitedById, inviterUserId));
    return r?.count ?? 0;
  }

  async listActiveReferralCodesByInviter(inviterUserId: string): Promise<{ id: string; code: string; expiresAt: Date }[]> {
    const now = new Date();
    return this.db
      .select({ id: referralCodes.id, code: referralCodes.code, expiresAt: referralCodes.expiresAt })
      .from(referralCodes)
      .where(and(eq(referralCodes.inviterUserId, inviterUserId), gt(referralCodes.expiresAt, now), isNull(referralCodes.usedAt)))
      .orderBy(desc(referralCodes.expiresAt));
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

  async getOrCreateDmChat(userId: string, otherUserId: string): Promise<Chat> {
    const myChats = await this.db
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .where(eq(chatMembers.userId, userId));
    for (const { chatId } of myChats) {
      const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
      if (!chat || chat.type !== "dm") continue;
      const members = await this.db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId));
      const ids = new Set(members.map((m) => m.userId));
      if (ids.has(userId) && ids.has(otherUserId) && ids.size === 2) return chat;
    }
    const [chat] = await this.db.insert(chats).values({ type: "dm", name: null }).returning();
    if (!chat) throw new Error("Create chat failed");
    await this.db.insert(chatMembers).values([
      { chatId: chat.id, userId, role: "admin" },
      { chatId: chat.id, userId: otherUserId, role: "member" },
    ]);
    return chat;
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

  async updateLastRead(chatId: string, userId: string): Promise<void> {
    await this.db
      .update(chatMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
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
    if (!since) {
      const [r] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(eq(messages.chatId, chatId));
      return r?.count ?? 0;
    }
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), gt(messages.createdAt, since)));
    return r?.count ?? 0;
  }

  async getMessagesByChatId(chatId: string, limit = 100, beforeMessageId?: string): Promise<Message[]> {
    const conditions = [eq(messages.chatId, chatId)];
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
    return rows.reverse();
  }

  async getLastMessage(chatId: string): Promise<Message | undefined> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    return row;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [row] = await this.db.insert(messages).values(data).returning();
    if (!row) throw new Error("Insert message failed");
    return row;
  }

  async getMessage(chatId: string, messageId: string): Promise<Message | undefined> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .limit(1);
    return row;
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
    return row;
  }

  async searchMessages(
    userId: string,
    query: string,
    limit: number
  ): Promise<{ messageId: string; chatId: string; content: string; createdAt: Date; chatName: string }[]> {
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    const rows = await this.db
      .select({
        id: messages.id,
        chatId: messages.chatId,
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

  async updateUserProfile(userId: string, data: UpdateProfile): Promise<User | undefined> {
    const update: Record<string, unknown> = {};
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.surname !== undefined) update.surname = data.surname;
    if (data.gender !== undefined) update.gender = data.gender;
    if (data.birthDate !== undefined) update.birthDate = data.birthDate;
    if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;
    if (data.hideFromSearch !== undefined) update.hideFromSearch = data.hideFromSearch;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.coverUrl !== undefined) update.coverUrl = data.coverUrl;
    if (data.profileLink !== undefined) update.profileLink = data.profileLink;
    if (data.city !== undefined) update.city = data.city;
    if (data.status !== undefined) update.status = data.status;
    if (data.pinnedPostId !== undefined) update.pinnedPostId = data.pinnedPostId;
    if (data.profileVisibility !== undefined) update.profileVisibility = data.profileVisibility;
    if (data.showOnlineTo !== undefined) update.showOnlineTo = data.showOnlineTo;
    if (data.pushEnabled !== undefined) update.pushEnabled = data.pushEnabled;
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

  async addFollow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) return;
    const existing = await this.isFollowing(followerId, followingId);
    if (existing) return;
    await this.db.insert(follows).values({ followerId, followingId });
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

  async getUserByPublicId(publicId: number): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.publicId, publicId)).limit(1);
    return row;
  }

  async addBlock(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) return;
    const [existing] = await this.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);
    if (existing) return;
    await this.db.insert(userBlocks).values({ blockerId, blockedId });
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

  async getBlockedRelationIds(viewerId: string): Promise<string[]> {
    const asBlocker = await this.db
      .select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, viewerId));
    const asBlocked = await this.db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(eq(userBlocks.blockedId, viewerId));
    const set = new Set<string>();
    asBlocker.forEach((r) => set.add(r.blockedId));
    asBlocked.forEach((r) => set.add(r.blockerId));
    return Array.from(set);
  }
}
