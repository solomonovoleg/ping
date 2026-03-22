import type { IStorage } from "./types";
import type {
  ChatFolder,
  ChatVibeState,
  ChatVibeBatch,
  ChatVibeHistoryEntry,
  CallSessionHistory,
  CallParticipantHistory,
  CallTranscriptSegment,
  CallCommandSuggestion,
  UserReminder,
  VoiceTask,
} from "@shared/schema";
import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";
import { createUsersStore } from "./users-store";
import { createChatsStore } from "./chats-store";
import { createMessagesStore } from "./messages-store";
import { createReferralCodesStore } from "./referral-codes-store";
import { randomUUID } from "crypto";

/** In-memory contacts: ownerId -> Set of contactUserId */
const contactsMap = new Map<string, Set<string>>();

/** In-memory folders: chatId -> ChatFolder[] */
const foldersByChat = new Map<string, ChatFolder[]>();

/** In-memory follows: followerId -> Set of followingId */
const followsMap = new Map<string, Set<string>>();

type MemBlockFlags = { restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean };

function memBlockFull(f: MemBlockFlags): boolean {
  return f.restrictProfile === true && f.restrictChat === true && f.restrictSocial === true;
}

/** In-memory blocks: blockerId -> blockedId -> flags */
const blocksMap = new Map<string, Map<string, MemBlockFlags>>();

/** «Удалено для себя»: key = `${userId}:${chatId}` -> Set<messageId> */
const messageHiddenMap = new Map<string, Set<string>>();

/** key = `${userId}\t${chatId}` */
const chatMemberPrefsMem = new Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>();

function chatMemberPrefsKey(userId: string, chatId: string): string {
  return `${userId}\t${chatId}`;
}

const memUserReminders: UserReminder[] = [];
const memVoiceTasks: VoiceTask[] = [];

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

  async countMutualFollowingWhoFollowTarget(viewerId: string, targetUserId: string): Promise<number> {
    const following = await this.listFollowingIds(viewerId);
    let n = 0;
    for (const uid of following) {
      if (await this.isFollowing(uid, targetUserId)) n++;
    }
    return n;
  }

  async listMutualFollowingWhoFollowTarget(
    viewerId: string,
    targetUserId: string,
    limit: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    const cap = Math.min(Math.max(limit, 1), 20);
    const following = await this.listFollowingIds(viewerId);
    const out: {
      id: string;
      publicId: number;
      displayName: string | null;
      surname: string | null;
      avatarUrl: string | null;
    }[] = [];
    for (const uid of following) {
      if (!(await this.isFollowing(uid, targetUserId))) continue;
      const u = this.users.get(uid);
      if (!u || u.deletedAt || u.isBlocked) continue;
      out.push({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName ?? null,
        surname: u.surname ?? null,
        avatarUrl: u.avatarUrl ?? null,
      });
      if (out.length >= cap) break;
    }
    return out;
  }

  async addBlock(
    blockerId: string,
    blockedId: string,
    flags?: Partial<MemBlockFlags>,
  ): Promise<void> {
    if (blockerId === blockedId) return;
    const next: MemBlockFlags = {
      restrictProfile: flags?.restrictProfile !== false,
      restrictChat: flags?.restrictChat !== false,
      restrictSocial: flags?.restrictSocial !== false,
    };
    let inner = blocksMap.get(blockerId);
    if (!inner) {
      inner = new Map();
      blocksMap.set(blockerId, inner);
    }
    inner.set(blockedId, next);
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    const inner = blocksMap.get(blockerId);
    if (inner) inner.delete(blockedId);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const inner = blocksMap.get(blockerId);
    return Promise.resolve(inner ? inner.has(blockedId) : false);
  }

  async getBlockFlags(blockerId: string, blockedId: string): Promise<MemBlockFlags | null> {
    const inner = blocksMap.get(blockerId);
    const f = inner?.get(blockedId);
    return Promise.resolve(f ? { ...f } : null);
  }

  async getBlockedRelationIds(viewerId: string): Promise<string[]> {
    const out = new Set<string>();
    const blocked = blocksMap.get(viewerId);
    if (blocked) {
      blocked.forEach((f, id) => {
        if (memBlockFull(f)) out.add(id);
      });
    }
    blocksMap.forEach((inner, blockerId) => {
      const f = inner.get(viewerId);
      if (f && memBlockFull(f)) out.add(blockerId);
    });
    return Promise.resolve(Array.from(out));
  }

  async searchUsers(query: string, excludeUserId: string): Promise<import("@shared/schema").User[]> {
    const list = this.users.search(query);
    return Promise.resolve(list.filter((u) => u.id !== excludeUserId));
  }

  async findUsersDiscoverableByPhones(phones: string[], excludeUserId: string): Promise<import("@shared/schema").User[]> {
    const seen = new Set<string>();
    const out: import("@shared/schema").User[] = [];
    for (const p of phones) {
      const u = this.users.getByPhone(p);
      if (!u || u.id === excludeUserId || seen.has(u.id)) continue;
      if ((u as { deletedAt?: Date | null }).deletedAt || u.isBlocked || u.hideFromSearch) continue;
      seen.add(u.id);
      out.push(u);
    }
    return Promise.resolve(out);
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

  async getUserRegistrationsByDay(days: number) {
    return Promise.resolve(this.users.getRegistrationsByDay(days));
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

  async createReferralCode(inviterUserId: string, code: string, expiresAt: Date, opts?: { maxUses?: number }) {
    let maxUses = opts?.maxUses ?? 1;
    if (maxUses === 0 || maxUses < -1) maxUses = 1;
    if (maxUses > 10_000) maxUses = 10_000;
    const row = this.referralCodes.create(inviterUserId, code, expiresAt, maxUses);
    return Promise.resolve({ id: row.id, code: row.code, expiresAt: row.expiresAt, maxUses: row.maxUses });
  }

  async getReferralCodeByCode(code: string) {
    const row = this.referralCodes.getByCode(code);
    if (!row) return Promise.resolve(undefined);
    return Promise.resolve({ id: row.id, inviterUserId: row.inviterUserId, expiresAt: row.expiresAt });
  }

  async consumeReferralCode(codeId: string) {
    return Promise.resolve(this.referralCodes.consume(codeId));
  }

  async countReferralsByInviter(inviterUserId: string) {
    return Promise.resolve(this.users.countReferralsByInviter(inviterUserId));
  }

  async listActiveReferralCodesByInviter(inviterUserId: string) {
    const list = this.referralCodes.listActiveByInviter(inviterUserId);
    return Promise.resolve(
      list.map((r) => ({
        id: r.id,
        code: r.code,
        expiresAt: r.expiresAt,
        maxUses: r.maxUses,
        useCount: r.useCount,
      }))
    );
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

  async getChatMember(chatId: string, userId: string) {
    return Promise.resolve(this.chats.getMember(chatId, userId));
  }

  async getChatMemberIds(chatId: string) {
    return Promise.resolve(this.chats.getMemberIds(chatId));
  }

  async getChatsForUser(userId: string) {
    return Promise.resolve(this.chats.getByUserId(userId));
  }

  async getChatMemberPrefsForUser(
    userId: string
  ): Promise<Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>> {
    const m = new Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>();
    const prefix = `${userId}\t`;
    for (const [k, v] of chatMemberPrefsMem.entries()) {
      if (k.startsWith(prefix)) {
        const chatId = k.slice(prefix.length);
        m.set(chatId, v);
      }
    }
    return Promise.resolve(m);
  }

  async upsertChatMemberPrefs(
    userId: string,
    chatId: string,
    patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string }
  ): Promise<void> {
    const k = chatMemberPrefsKey(userId, chatId);
    const prev = chatMemberPrefsMem.get(k);
    chatMemberPrefsMem.set(k, {
      pinnedAt: patch.pinnedAt !== undefined ? patch.pinnedAt : prev?.pinnedAt ?? null,
      hiddenAt: patch.hiddenAt !== undefined ? patch.hiddenAt : prev?.hiddenAt ?? null,
      listSection: patch.listSection !== undefined ? patch.listSection : prev?.listSection ?? "general",
    });
  }

  async deleteChatCascade(chatId: string): Promise<boolean> {
    if (!this.chats.getById(chatId)) return Promise.resolve(false);
    this.messages.purgeChat(chatId);
    foldersByChat.delete(chatId);
    for (const k of [...chatMemberPrefsMem.keys()]) {
      if (k.endsWith(`\t${chatId}`)) chatMemberPrefsMem.delete(k);
    }
    this.chats.deleteChat(chatId);
    return Promise.resolve(true);
  }

  async deleteChatMemberPrefs(userId: string, chatId: string): Promise<void> {
    chatMemberPrefsMem.delete(chatMemberPrefsKey(userId, chatId));
    return Promise.resolve();
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

  async removeChatMember(chatId: string, userId: string): Promise<boolean> {
    return Promise.resolve(this.chats.removeMember(chatId, userId));
  }

  async updateChat(chatId: string, data: { name?: string; avatarUrl?: string }) {
    return Promise.resolve(this.chats.update(chatId, data));
  }

  async getMessagesByChatId(chatId: string, limit?: number, beforeMessageId?: string, folderId?: string | null) {
    return Promise.resolve(this.messages.getByChatId(chatId, limit, beforeMessageId, folderId));
  }

  async getMediaMessages(chatId: string, folderId: string | null, limit: number, beforeMessageId?: string) {
    const list = this.messages.getByChatId(chatId, limit * 2, beforeMessageId, folderId);
    const media = list.filter((m) => ["image", "video", "voice", "video_note"].includes((m as { type?: string }).type ?? ""));
    return Promise.resolve(media.slice(-limit));
  }

  async getTextMessagesForLinks(chatId: string, folderId: string | null, limit: number, beforeMessageId?: string) {
    const list = this.messages.getByChatId(chatId, limit, beforeMessageId, folderId);
    const text = list.filter((m) => (m as { type?: string }).type === "text");
    return Promise.resolve(text.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt })));
  }

  async listChatFolders(chatId: string): Promise<ChatFolder[]> {
    const list = foldersByChat.get(chatId) ?? [];
    return Promise.resolve([...list].sort((a, b) => a.orderIndex - b.orderIndex));
  }

  async getOrCreateMainFolder(chatId: string): Promise<ChatFolder> {
    let list = foldersByChat.get(chatId);
    const main = list?.find((f) => f.isMain);
    if (main) return Promise.resolve(main);
    const folder: ChatFolder = {
      id: randomUUID(),
      chatId,
      name: "Общий",
      isMain: true,
      orderIndex: 0,
      createdAt: new Date(),
    };
    list = list ?? [];
    list.push(folder);
    foldersByChat.set(chatId, list);
    return Promise.resolve(folder);
  }

  async createChatFolder(chatId: string, name: string, orderIndex: number): Promise<ChatFolder> {
    const folder: ChatFolder = {
      id: randomUUID(),
      chatId,
      name: name.trim(),
      isMain: false,
      orderIndex,
      createdAt: new Date(),
    };
    const list = foldersByChat.get(chatId) ?? [];
    list.push(folder);
    foldersByChat.set(chatId, list);
    return Promise.resolve(folder);
  }

  async getChatFolder(folderId: string): Promise<ChatFolder | undefined> {
    const lists = Array.from(foldersByChat.values());
    for (const list of lists) {
      const f = list.find((x: ChatFolder) => x.id === folderId);
      if (f) return Promise.resolve(f);
    }
    return Promise.resolve(undefined);
  }

  async updateChatFolder(folderId: string, data: { name?: string }): Promise<ChatFolder | undefined> {
    const lists = Array.from(foldersByChat.values());
    for (const list of lists) {
      const f = list.find((x: ChatFolder) => x.id === folderId);
      if (f && data.name?.trim()) {
        f.name = data.name.trim();
        return Promise.resolve(f);
      }
    }
    return Promise.resolve(undefined);
  }

  async deleteChatFolder(folderId: string): Promise<boolean> {
    const entries = Array.from(foldersByChat.entries());
    for (const [chatId, list] of entries) {
      const f = list.find((x: ChatFolder) => x.id === folderId);
      if (f && !f.isMain) {
        foldersByChat.set(chatId, list.filter((x: ChatFolder) => x.id !== folderId));
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
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

  async updateMessageTranscript(chatId: string, messageId: string, transcript: string) {
    return Promise.resolve(this.messages.updateTranscript(chatId, messageId, transcript));
  }

  async addMessageHidden(userId: string, chatId: string, messageId: string): Promise<void> {
    const key = `${userId}:${chatId}`;
    let set = messageHiddenMap.get(key);
    if (!set) {
      set = new Set();
      messageHiddenMap.set(key, set);
    }
    set.add(messageId);
  }

  async getHiddenMessageIdsForUserInChat(userId: string, chatId: string): Promise<string[]> {
    const key = `${userId}:${chatId}`;
    const set = messageHiddenMap.get(key);
    return Promise.resolve(set ? Array.from(set) : []);
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
    const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return Promise.resolve({ id, scheduledAt: data.scheduledAt });
  }

  async getScheduledMessagesDue(_limit: number): Promise<
    { id: string; chatId: string; folderId: string | null; senderId: string | null; type: string; content: string; replyToId: string | null }[]
  > {
    return Promise.resolve([]);
  }

  async deleteScheduledMessage(_id: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  async updateLastRead(chatId: string, userId: string, readUpTo?: Date): Promise<void> {
    if (!readUpTo) return;
    const newAt = readUpTo;
    const current = await this.getChatMemberLastReadAt(chatId, userId);
    const at = !current || newAt > current ? newAt : current;
    this.chats.setLastRead(chatId, userId, at instanceof Date ? at : new Date(at));
  }

  async updateLastReadByMessageId(chatId: string, userId: string, messageId: string): Promise<void> {
    const msg = await this.getMessage(chatId, messageId);
    if (msg?.createdAt) {
      await this.updateLastRead(chatId, userId, msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt));
    }
  }

  async getChatMemberLastReadAt(chatId: string, userId: string): Promise<Date | null> {
    const m = this.chats.getMember(chatId, userId);
    return m?.lastReadAt ?? null;
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const member = this.chats.getMember(chatId, userId);
    const since = member?.lastReadAt ? new Date(member.lastReadAt) : null;
    const list = this.messages.getByChatId(chatId);
    const fromOthers = (m: { senderId?: string | null }) => m.senderId == null || m.senderId !== userId;
    if (!since) return list.filter(fromOthers).length;
    return list.filter((m) => fromOthers(m) && new Date(m.createdAt) > since).length;
  }

  async getUnreadCountByFolder(chatId: string, folderId: string | null, userId: string): Promise<number> {
    const member = this.chats.getMember(chatId, userId);
    const since = member?.lastReadAt ? new Date(member.lastReadAt) : null;
    const list = this.messages.getByChatId(chatId, undefined, undefined, folderId);
    const fromOthers = (m: { senderId?: string | null }) => m.senderId == null || m.senderId !== userId;
    if (!since) return list.filter(fromOthers).length;
    return list.filter((m) => fromOthers(m) && new Date(m.createdAt) > since).length;
  }

  async getMessageCountByFolder(chatId: string, folderId: string): Promise<number> {
    const list = this.messages.getByChatId(chatId, undefined, undefined, folderId);
    return list.length;
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

  async createTrack(userId: string, name: string): Promise<{ id: string; name: string; createdAt: Date }> {
    const id = crypto.randomUUID();
    return { id, name: name.trim() || "Новый трек", createdAt: new Date() };
  }

  async listTracks(_userId: string): Promise<{ id: string; name: string; createdAt: Date; totalItems: number; activeItems: number; doneItems: number }[]> {
    return [];
  }

  async getTrack(_userId: string, _trackId: string): Promise<{ id: string; name: string; createdAt: Date } | undefined> {
    return undefined;
  }

  async addMessageToTrack(_userId: string, _trackId: string, _messageId: string, _chatId: string): Promise<void> {
    return Promise.resolve();
  }

  async addCallSegmentToTrack(_userId: string, _trackId: string, _segmentId: string): Promise<void> {
    return Promise.resolve();
  }

  async removeTrackItem(_userId: string, _trackId: string, _itemId: string): Promise<void> {
    return Promise.resolve();
  }

  async updateTrack(_userId: string, _trackId: string, _data: { name: string }): Promise<void> {
    return Promise.resolve();
  }

  async deleteTrack(_userId: string, _trackId: string): Promise<void> {
    return Promise.resolve();
  }

  async getTracksStats(_userId: string): Promise<{ totalTracks: number; activeItemsCount: number; doneItemsCount: number; lastAddedAt: Date | null }> {
    return { totalTracks: 0, activeItemsCount: 0, doneItemsCount: 0, lastAddedAt: null };
  }

  async setTrackItemDone(_userId: string, _trackId: string, _itemId: string, _done: boolean): Promise<void> {
    return Promise.resolve();
  }

  async listTrackItems(
    _userId: string,
    _trackId: string
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
    return [];
  }

  async createCallSessionHistory(data: {
    id: string;
    chatId: string;
    mediaType: "audio" | "video";
    createdByUserId: string;
  }): Promise<CallSessionHistory> {
    return {
      id: data.id,
      chatId: data.chatId,
      mediaType: data.mediaType,
      createdByUserId: data.createdByUserId,
      createdAt: new Date(),
      endedAt: null,
    };
  }

  async endCallSessionHistory(_callId: string): Promise<void> {
    return Promise.resolve();
  }

  async upsertCallParticipantHistory(callId: string, userId: string, displayNameSnapshot: string): Promise<CallParticipantHistory> {
    return {
      id: randomUUID(),
      callId,
      userId,
      displayNameSnapshot,
      joinedAt: new Date(),
      leftAt: null,
    };
  }

  async markCallParticipantLeft(_callId: string, _userId: string): Promise<void> {
    return Promise.resolve();
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
    const now = new Date();
    return {
      id: data.id,
      callId: data.callId,
      speakerUserId: data.speakerUserId,
      speakerDisplayName: data.speakerDisplayName,
      sourceStreamId: data.sourceStreamId ?? null,
      language: data.language ?? "ru-RU",
      textRaw: data.textRaw,
      textNormalized: data.textNormalized,
      confidence: data.confidence,
      startedAtMs: data.startedAtMs,
      endedAtMs: data.endedAtMs,
      isFinal: data.isFinal,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getCallTranscriptSegment(_callId: string, _segmentId: string): Promise<CallTranscriptSegment | undefined> {
    return undefined;
  }

  async listCallTranscriptSegments(_userId: string, _callId: string): Promise<CallTranscriptSegment[]> {
    return [];
  }

  async listCallSessionsHistory(_userId: string): Promise<Array<CallSessionHistory & { participantCount: number; chatName: string }>> {
    return [];
  }

  async createCallCommandSuggestion(data: {
    callId: string;
    segmentId?: string | null;
    intentType: string;
    title: string;
    payloadJson: string;
  }): Promise<CallCommandSuggestion> {
    return {
      id: randomUUID(),
      callId: data.callId,
      segmentId: data.segmentId ?? null,
      intentType: data.intentType,
      title: data.title,
      payloadJson: data.payloadJson,
      status: "pending",
      createdAt: new Date(),
      resolvedAt: null,
      resolvedByUserId: null,
    };
  }

  async listCallCommandSuggestions(_userId: string, _callId: string): Promise<CallCommandSuggestion[]> {
    return [];
  }

  async resolveCallCommandSuggestion(
    _userId: string,
    _callId: string,
    _suggestionId: string,
    _status: "accepted" | "dismissed",
  ): Promise<void> {
    return Promise.resolve();
  }

  // ── Chat Vibe (in-memory stubs) ───────────────────────────

  private vibeStates = new Map<string, ChatVibeState>();

  async getVibeState(chatId: string): Promise<ChatVibeState | undefined> {
    return this.vibeStates.get(chatId);
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
    const existing = this.vibeStates.get(chatId);
    const touchBatch = data.touchLastBatchAt === true;
    const row: ChatVibeState = {
      id: existing?.id ?? crypto.randomUUID(),
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
      themeVersion: data.themeVersion ?? (existing?.themeVersion ?? 1),
      lastBatchAt: touchBatch ? now : (existing?.lastBatchAt ?? null),
      updatedAt: now,
    };
    this.vibeStates.set(chatId, row);
    return row;
  }

  async createVibeBatch(data: {
    chatId: string; windowSize: number; dominantPattern: VibeThemeCode;
    secondaryPattern?: VibeThemeCode; confidence: number; axes: VibeAxes; toxicityFlag?: boolean;
  }): Promise<ChatVibeBatch> {
    return {
      id: crypto.randomUUID(),
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
      createdAt: new Date(),
    };
  }

  async getRecentVibeBatches(_chatId: string, _limit: number): Promise<ChatVibeBatch[]> {
    return [];
  }

  async createVibeHistoryEntry(data: {
    chatId: string; oldTheme: string; newTheme: string;
    oldConfidence: number; newConfidence: number; triggerType: string;
  }): Promise<ChatVibeHistoryEntry> {
    return {
      id: crypto.randomUUID(),
      chatId: data.chatId,
      oldTheme: data.oldTheme,
      newTheme: data.newTheme,
      oldConfidence: String(data.oldConfidence),
      newConfidence: String(data.newConfidence),
      triggerType: data.triggerType,
      createdAt: new Date(),
    };
  }

  async createUserReminder(data: { userId: string; title: string; fireAt: Date }): Promise<UserReminder> {
    const row: UserReminder = {
      id: crypto.randomUUID(),
      userId: data.userId,
      title: data.title.trim() || "Напоминание",
      fireAt: data.fireAt,
      dismissedAt: null,
      createdAt: new Date(),
    };
    memUserReminders.push(row);
    return row;
  }

  async listDueUserReminders(userId: string, before: Date): Promise<UserReminder[]> {
    return memUserReminders
      .filter((r) => r.userId === userId && !r.dismissedAt && r.fireAt <= before)
      .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
      .slice(0, 50);
  }

  async dismissUserReminder(userId: string, id: string): Promise<boolean> {
    const row = memUserReminders.find((r) => r.id === id && r.userId === userId && !r.dismissedAt);
    if (!row) return false;
    row.dismissedAt = new Date();
    return true;
  }

  async createVoiceTask(data: { userId: string; title: string }): Promise<VoiceTask> {
    const row: VoiceTask = {
      id: crypto.randomUUID(),
      userId: data.userId,
      title: data.title.trim() || "Задача",
      doneAt: null,
      createdAt: new Date(),
    };
    memVoiceTasks.push(row);
    return row;
  }

  async listOpenVoiceTasks(userId: string, limit: number): Promise<VoiceTask[]> {
    const lim = Math.min(100, Math.max(1, limit));
    return memVoiceTasks
      .filter((t) => t.userId === userId && !t.doneAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, lim);
  }

  async completeVoiceTask(userId: string, id: string): Promise<boolean> {
    const row = memVoiceTasks.find((t) => t.id === id && t.userId === userId && !t.doneAt);
    if (!row) return false;
    row.doneAt = new Date();
    return true;
  }
}
