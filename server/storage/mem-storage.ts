import type { IStorage } from "./types";
import { createUsersStore } from "./users-store";
import { createChatsStore } from "./chats-store";
import { createMessagesStore } from "./messages-store";
import { createReferralCodesStore } from "./referral-codes-store";

/** In-memory contacts: ownerId -> Set of contactUserId */
const contactsMap = new Map<string, Set<string>>();

/** In-memory follows: followerId -> Set of followingId */
const followsMap = new Map<string, Set<string>>();

/** In-memory blocks: blockerId -> Set of blockedId */
const blocksMap = new Map<string, Set<string>>();

export class MemStorage implements IStorage {
  private users = createUsersStore();
  private chats = createChatsStore();
  private messages = createMessagesStore();
  private referralCodes = createReferralCodesStore();

  async getUser(id: string) {
    return Promise.resolve(this.users.get(id));
  }

  async getUserByPhone(phone: string) {
    return Promise.resolve(this.users.getByPhone(phone));
  }

  async getUserByPublicId(publicId: number) {
    return Promise.resolve(this.users.getByPublicId(publicId));
  }

  async isContact(ownerId: string, contactUserId: string): Promise<boolean> {
    const set = contactsMap.get(ownerId);
    return Promise.resolve(set ? set.has(contactUserId) : false);
  }

  async addContact(ownerId: string, contactUserId: string): Promise<void> {
    let set = contactsMap.get(ownerId);
    if (!set) {
      set = new Set();
      contactsMap.set(ownerId, set);
    }
    set.add(contactUserId);
  }

  async listContactUserIds(ownerId: string): Promise<string[]> {
    const set = contactsMap.get(ownerId);
    return Promise.resolve(set ? Array.from(set) : []);
  }

  async addFollow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) return;
    let set = followsMap.get(followerId);
    if (!set) {
      set = new Set();
      followsMap.set(followerId, set);
    }
    set.add(followingId);
  }

  async removeFollow(followerId: string, followingId: string): Promise<void> {
    const set = followsMap.get(followerId);
    if (set) set.delete(followingId);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const set = followsMap.get(followerId);
    return Promise.resolve(set ? set.has(followingId) : false);
  }

  async listFollowingIds(followerId: string): Promise<string[]> {
    const set = followsMap.get(followerId);
    return Promise.resolve(set ? Array.from(set) : []);
  }

  async listFollowerIds(userId: string): Promise<string[]> {
    const out: string[] = [];
    followsMap.forEach((set, followerId) => {
      if (set.has(userId)) out.push(followerId);
    });
    return Promise.resolve(out);
  }

  async getFollowersCount(userId: string): Promise<number> {
    return this.listFollowerIds(userId).then((a) => a.length);
  }

  async getFollowingCount(userId: string): Promise<number> {
    return this.listFollowingIds(userId).then((a) => a.length);
  }

  async getFollowersList(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    const ids = (await this.listFollowerIds(userId)).slice(offset, offset + limit);
    const list = ids.map((id) => this.users.get(id)).filter(Boolean) as import("@shared/schema").User[];
    return Promise.resolve(
      list.map((u) => ({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName ?? null,
        surname: u.surname ?? null,
        avatarUrl: u.avatarUrl ?? null,
      }))
    );
  }

  async getFollowingList(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    const ids = (await this.listFollowingIds(userId)).slice(offset, offset + limit);
    const list = ids.map((id) => this.users.get(id)).filter(Boolean) as import("@shared/schema").User[];
    return Promise.resolve(
      list.map((u) => ({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName ?? null,
        surname: u.surname ?? null,
        avatarUrl: u.avatarUrl ?? null,
      }))
    );
  }

  async addBlock(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) return;
    let set = blocksMap.get(blockerId);
    if (!set) {
      set = new Set();
      blocksMap.set(blockerId, set);
    }
    set.add(blockedId);
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    const set = blocksMap.get(blockerId);
    if (set) set.delete(blockedId);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const set = blocksMap.get(blockerId);
    return Promise.resolve(set ? set.has(blockedId) : false);
  }

  async getBlockedRelationIds(viewerId: string): Promise<string[]> {
    const out = new Set<string>();
    const blocked = blocksMap.get(viewerId);
    if (blocked) blocked.forEach((id) => out.add(id));
    blocksMap.forEach((set, blockerId) => {
      if (set.has(viewerId)) out.add(blockerId);
    });
    return Promise.resolve(Array.from(out));
  }

  async searchUsers(query: string, excludeUserId: string): Promise<import("@shared/schema").User[]> {
    const list = this.users.search(query);
    return Promise.resolve(list.filter((u) => u.id !== excludeUserId));
  }

  async getNextPublicId() {
    return Promise.resolve(this.users.getNextPublicId());
  }

  async createUser(user: Parameters<IStorage["createUser"]>[0]) {
    return Promise.resolve(this.users.create(user as import("@shared/schema").InsertUser));
  }

  async updateUserProfile(userId: string, data: Parameters<IStorage["updateUserProfile"]>[1]) {
    this.users.updateProfile(userId, data);
    return Promise.resolve(this.users.get(userId));
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    this.users.setLastSeen(userId, new Date());
  }

  async updateUserFcmToken(userId: string, token: string | null): Promise<void> {
    this.users.setFcmToken(userId, token);
  }

  async getAdminStats() {
    return Promise.resolve(this.users.getAdminStats());
  }

  async listUsersForAdmin(opts: {
    limit: number;
    offset: number;
    includeDeleted?: boolean;
    search?: string;
  }) {
    return Promise.resolve(this.users.listForAdmin(opts));
  }

  async setUserBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }) {
    this.users.setBlocked(userId, blocked, opts);
    const u = this.users.get(userId);
    return Promise.resolve(u);
  }

  async setPlatformRole(userId: string, role: string) {
    this.users.setPlatformRole(userId, role);
    const u = this.users.get(userId);
    return Promise.resolve(u);
  }

  async listAdmins() {
    const list = this.users.listAdmins();
    return Promise.resolve(
      list.map((u) => ({
        id: u.id,
        publicId: u.publicId,
        phone: u.phone,
        displayName: u.displayName,
        surname: u.surname,
        platformRole: u.platformRole,
      }))
    );
  }

  async setUserDeleted(userId: string, deleted: boolean) {
    this.users.setDeleted(userId, deleted);
    const u = this.users.get(userId);
    return Promise.resolve(u);
  }

  async createReferralCode(inviterUserId: string, code: string, expiresAt: Date) {
    const row = this.referralCodes.create(inviterUserId, code, expiresAt);
    return Promise.resolve({ id: row.id, code: row.code, expiresAt: row.expiresAt });
  }

  async getReferralCodeByCode(code: string) {
    const row = this.referralCodes.getByCode(code);
    if (!row) return Promise.resolve(undefined);
    return Promise.resolve({ id: row.id, inviterUserId: row.inviterUserId, expiresAt: row.expiresAt });
  }

  async markReferralCodeUsed(codeId: string) {
    this.referralCodes.markUsed(codeId);
    return Promise.resolve();
  }

  async countReferralsByInviter(inviterUserId: string) {
    return Promise.resolve(this.users.countReferralsByInviter(inviterUserId));
  }

  async listActiveReferralCodesByInviter(inviterUserId: string) {
    const list = this.referralCodes.listActiveByInviter(inviterUserId);
    return Promise.resolve(list.map((r) => ({ id: r.id, code: r.code, expiresAt: r.expiresAt })));
  }

  async getReferralCountsForUserIds(userIds: string[]) {
    const out: Record<string, number> = {};
    for (const id of userIds) out[id] = this.users.countReferralsByInviter(id);
    return Promise.resolve(out);
  }

  async listInvitedUsers(inviterUserId: string) {
    const list = this.users.listInvitedBy(inviterUserId);
    return Promise.resolve(
      list.map((u) => ({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName,
        surname: u.surname,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
      }))
    );
  }

  async getChatById(id: string) {
    return Promise.resolve(this.chats.getById(id));
  }

  async getChatMemberIds(chatId: string) {
    return Promise.resolve(this.chats.getMemberIds(chatId));
  }

  async getChatsForUser(userId: string) {
    return Promise.resolve(this.chats.getByUserId(userId));
  }

  async getOrCreateDmChat(userId: string, otherUserId: string): Promise<import("@shared/schema").Chat> {
    const existing = this.chats.getDmBetween(userId, otherUserId);
    if (existing) return Promise.resolve(existing);
    const chat = this.chats.create({ type: "dm", name: null });
    this.chats.addMember({ chatId: chat.id, userId, role: "admin" });
    this.chats.addMember({ chatId: chat.id, userId: otherUserId, role: "member" });
    return Promise.resolve(chat);
  }

  async createChat(data: Parameters<IStorage["createChat"]>[0]) {
    return Promise.resolve(this.chats.create(data));
  }

  async addChatMember(data: Parameters<IStorage["addChatMember"]>[0]) {
    return Promise.resolve(this.chats.addMember(data));
  }

  async getMessagesByChatId(chatId: string, limit?: number, beforeMessageId?: string) {
    return Promise.resolve(this.messages.getByChatId(chatId, limit, beforeMessageId));
  }

  async getLastMessage(chatId: string) {
    const list = this.messages.getByChatId(chatId, 1);
    return Promise.resolve(list[0]);
  }

  async createMessage(data: Parameters<IStorage["createMessage"]>[0]) {
    return Promise.resolve(this.messages.create(data));
  }

  async getMessage(chatId: string, messageId: string) {
    return Promise.resolve(this.messages.get(chatId, messageId));
  }

  async deleteMessage(chatId: string, messageId: string) {
    return Promise.resolve(this.messages.delete(chatId, messageId));
  }

  async updateMessage(chatId: string, messageId: string, content: string) {
    return Promise.resolve(this.messages.update(chatId, messageId, content));
  }

  async updateLastRead(chatId: string, userId: string): Promise<void> {
    this.chats.setLastRead(chatId, userId, new Date());
  }

  async getChatMemberLastReadAt(chatId: string, userId: string): Promise<Date | null> {
    const m = this.chats.getMember(chatId, userId);
    return m?.lastReadAt ?? null;
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const member = this.chats.getMember(chatId, userId);
    const since = member?.lastReadAt ? new Date(member.lastReadAt) : null;
    const list = this.messages.getByChatId(chatId);
    if (!since) return list.length;
    return list.filter((m) => new Date(m.createdAt) > since).length;
  }

  async searchMessages(
    _userId: string,
    _query: string,
    _limit: number
  ): Promise<{ messageId: string; chatId: string; content: string; createdAt: Date; chatName: string }[]> {
    return Promise.resolve([]);
  }

  async saveMessage(_userId: string, _messageId: string, _chatId: string): Promise<void> {
    return Promise.resolve();
  }

  async unsaveMessage(_userId: string, _messageId: string): Promise<void> {
    return Promise.resolve();
  }

  async listSavedMessages(
    _userId: string,
    _limit: number,
    _offset: number
  ): Promise<
    { messageId: string; chatId: string; savedAt: Date; content: string; type: string; chatName: string }[]
  > {
    return Promise.resolve([]);
  }

  async isMessageSaved(_userId: string, _messageId: string): Promise<boolean> {
    return Promise.resolve(false);
  }
}
