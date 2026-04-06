/**
 * PostgreSQL-реализация `IStorage`: тонкий фасад.
 * Реализация методов по доменам — `db-storage-segment-*.ts`; запросы — `db-storage-facade-queries.ts`.
 */
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
  CallTranscriptSegment,
  ChatFolder,
  ChatVibeState,
  ChatVibeBatch,
  ChatVibeHistoryEntry,
  UserReminder,
  VoiceTask,
} from "@shared/schema";
import { users } from "@shared/schema";
import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";
import { callSessionsHistory } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ensureUserColumns, getDb, getPool } from "../db";
import { createDbStorageFacadeQueryCallbacks } from "./db-storage-facade-context";
import type { SignupRiskSummary } from "../admin/signup-risk";
import type { CallTranscriptSegmentUpsertInput } from "./db-storage-call-transcript-segment-payload";
import { dbStorageBuildChatNameResolverDeps } from "./db-storage-chat-name-resolver-deps";
import type { ChatNameResolverDeps } from "./db-storage-message-search-saved-queries";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import { dbStorageSegmentAccount } from "./db-storage-segment-account";
import { dbStorageSegmentCalls } from "./db-storage-segment-calls";
import { dbStorageSegmentChat } from "./db-storage-segment-chat";
import { dbStorageSegmentMessages } from "./db-storage-segment-messages";
import { dbStorageSegmentPlanner } from "./db-storage-segment-planner";
import { dbStorageSegmentSearchSaved } from "./db-storage-segment-search-saved";
import { dbStorageSegmentSocial } from "./db-storage-segment-social";
import { dbStorageSegmentTracks } from "./db-storage-segment-tracks";

export class DbStorage implements IStorage {
  private db = getDb();
  private readonly pool = getPool();
  private readonly facadeCallbacks = createDbStorageFacadeQueryCallbacks(this);

  private chatNameDeps(): ChatNameResolverDeps {
    return dbStorageBuildChatNameResolverDeps(this);
  }

  /** Среда для сегментов (приватные поля класса не участвуют в структурной типизации снаружи). */
  private segment(): DbStorageSegmentHost {
    return this as unknown as DbStorageSegmentHost;
  }

  // ── Account / admin / referral ───────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    return dbStorageSegmentAccount.getUser(this.segment(), id);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return dbStorageSegmentAccount.getUserByPhone(this.segment(), phone);
  }

  async setUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    return dbStorageSegmentAccount.setUserPasswordHash(this.segment(), userId, passwordHash);
  }

  async findUsersDiscoverableByPhones(phones: string[], excludeUserId: string): Promise<User[]> {
    return dbStorageSegmentAccount.findUsersDiscoverableByPhones(this.segment(), phones, excludeUserId);
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    return dbStorageSegmentAccount.searchUsers(this.segment(), query, excludeUserId);
  }

  async getNextPublicId(): Promise<number> {
    return dbStorageSegmentAccount.getNextPublicId(this.segment());
  }

  async createUser(data: InsertUser): Promise<User> {
    return dbStorageSegmentAccount.createUser(this.segment(), data);
  }

  async applyStudioSyntheticFlags(userId: string, createdByAdminId: string): Promise<User | undefined> {
    await ensureUserColumns();
    const [row] = await this.db
      .update(users)
      .set({ isStudioSynthetic: true, studioCreatedByAdminId: createdByAdminId })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async listStudioSyntheticUsersForAdmin(opts: {
    limit: number;
    offset: number;
  }): Promise<{ users: User[]; total: number }> {
    await ensureUserColumns();
    const [cntRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isStudioSynthetic, true));
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.isStudioSynthetic, true))
      .orderBy(desc(users.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);
    return { users: rows, total: Number(cntRow?.c ?? 0) };
  }

  async listUsersRelatedBySignupSignals(
    userId: string,
    opts?: { limit?: number },
  ): Promise<{
    byDeviceId: User[];
    byIp: User[];
    byUaHash: User[];
    byClientSignalsHash: User[];
  }> {
    return dbStorageSegmentAccount.listUsersRelatedBySignupSignals(this.segment(), userId, opts);
  }

  async getAdminStats(): Promise<{ total: number; blocked: number; deleted: number; registeredToday: number }> {
    return dbStorageSegmentAccount.getAdminStats(this.segment());
  }

  async listUsersForAdmin(opts: {
    limit: number;
    offset: number;
    includeDeleted?: boolean;
    search?: string;
    sort?: "createdAt" | "referrals" | "invitedBy";
    sortDir?: "asc" | "desc";
  }): Promise<{ users: User[]; total: number }> {
    return dbStorageSegmentAccount.listUsersForAdmin(this.segment(), opts);
  }

  async getAdminUserSignupRiskSummaries(userIds: string[]): Promise<Record<string, SignupRiskSummary>> {
    return dbStorageSegmentAccount.getAdminUserSignupRiskSummaries(this.segment(), userIds);
  }

  async setUserBlocked(
    userId: string,
    blocked: boolean,
    opts?: { bannedBy: string; banReason?: string },
  ): Promise<User | undefined> {
    return dbStorageSegmentAccount.setUserBlocked(this.segment(), userId, blocked, opts);
  }

  async setUserDeleted(userId: string, deleted: boolean): Promise<User | undefined> {
    return dbStorageSegmentAccount.setUserDeleted(this.segment(), userId, deleted);
  }

  async purgeUserPermanently(userId: string): Promise<boolean> {
    return dbStorageSegmentAccount.purgeUserPermanently(this.segment(), userId);
  }

  async setPlatformRole(userId: string, role: string): Promise<User | undefined> {
    return dbStorageSegmentAccount.setPlatformRole(this.segment(), userId, role);
  }

  async listAdmins(): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "platformRole">[]> {
    return dbStorageSegmentAccount.listAdmins(this.segment());
  }

  async createReferralCode(
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
    return dbStorageSegmentAccount.createReferralCode(this.segment(), inviterUserId, code, expiresAt, opts);
  }

  async getReferralCodeByCode(
    code: string,
  ): Promise<{ id: string; inviterUserId: string; expiresAt: Date; bypassInviterLimit: boolean } | undefined> {
    return dbStorageSegmentAccount.getReferralCodeByCode(this.segment(), code);
  }

  async consumeReferralCode(codeId: string): Promise<boolean> {
    return dbStorageSegmentAccount.consumeReferralCode(this.segment(), codeId);
  }

  async countReferralsByInviter(inviterUserId: string): Promise<number> {
    return dbStorageSegmentAccount.countReferralsByInviter(this.segment(), inviterUserId);
  }

  async listActiveReferralCodesByInviter(
    inviterUserId: string,
  ): Promise<
    { id: string; code: string; expiresAt: Date; maxUses: number; useCount: number; adminNote: string | null }[]
  > {
    return dbStorageSegmentAccount.listActiveReferralCodesByInviter(this.segment(), inviterUserId);
  }

  async getUserRegistrationsByDay(days: number): Promise<{ day: string; count: number }[]> {
    return dbStorageSegmentAccount.getUserRegistrationsByDay(this.segment(), days);
  }

  async listInvitedUsers(
    inviterUserId: string,
  ): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "avatarUrl" | "createdAt">[]> {
    return dbStorageSegmentAccount.listInvitedUsers(this.segment(), inviterUserId);
  }

  async getReferralCountsForUserIds(userIds: string[]): Promise<Record<string, number>> {
    return dbStorageSegmentAccount.getReferralCountsForUserIds(this.segment(), userIds);
  }

  async getUsersPublicBriefByIds(
    userIds: string[],
  ): Promise<Record<string, { publicId: number; displayName: string | null; surname: string | null }>> {
    return dbStorageSegmentAccount.getUsersPublicBriefByIds(this.segment(), userIds);
  }

  async getUserByPublicId(publicId: number): Promise<User | undefined> {
    return dbStorageSegmentAccount.getUserByPublicId(this.segment(), publicId);
  }

  // ── Chats ───────────────────────────────────────────────────

  async getChatById(id: string): Promise<Chat | undefined> {
    return dbStorageSegmentChat.getChatById(this.segment(), id);
  }

  async getChatMember(chatId: string, userId: string): Promise<ChatMember | undefined> {
    return dbStorageSegmentChat.getChatMember(this.segment(), chatId, userId);
  }

  async getChatMemberIds(chatId: string): Promise<string[]> {
    return dbStorageSegmentChat.getChatMemberIds(this.segment(), chatId);
  }

  async getChatsForUser(userId: string): Promise<Chat[]> {
    return dbStorageSegmentChat.getChatsForUser(this.segment(), userId);
  }

  async getChatMemberPrefsForUser(
    userId: string,
  ): Promise<Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>> {
    return dbStorageSegmentChat.getChatMemberPrefsForUser(this.segment(), userId);
  }

  async upsertChatMemberPrefs(
    userId: string,
    chatId: string,
    patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string },
  ): Promise<void> {
    return dbStorageSegmentChat.upsertChatMemberPrefs(this.segment(), userId, chatId, patch);
  }

  async deleteChatCascade(chatId: string): Promise<boolean> {
    return dbStorageSegmentChat.deleteChatCascade(this.segment(), chatId);
  }

  async deleteChatMemberPrefs(userId: string, chatId: string): Promise<void> {
    return dbStorageSegmentChat.deleteChatMemberPrefs(this.segment(), userId, chatId);
  }

  async getChatMemberListSection(userId: string, chatId: string): Promise<string> {
    return dbStorageSegmentChat.getChatMemberListSection(this.segment(), userId, chatId);
  }

  async isChatListSectionPushMutedForUser(userId: string, section: string): Promise<boolean> {
    return dbStorageSegmentChat.isChatListSectionPushMutedForUser(this.segment(), userId, section);
  }

  async listUserChatListCustomFolders(userId: string) {
    return dbStorageSegmentChat.listUserChatListCustomFolders(this.segment(), userId);
  }

  async getUserChatListCustomFolder(userId: string, folderId: string) {
    return dbStorageSegmentChat.getUserChatListCustomFolder(this.segment(), userId, folderId);
  }

  async listUserChatListBuiltinTabPrefs(userId: string) {
    return dbStorageSegmentChat.listUserChatListBuiltinTabPrefs(this.segment(), userId);
  }

  async nextUserChatListCustomFolderSortOrder(userId: string): Promise<number> {
    return dbStorageSegmentChat.nextUserChatListCustomFolderSortOrder(this.segment(), userId);
  }

  async createUserChatListCustomFolder(userId: string, id: string, name: string, sortOrder: number): Promise<void> {
    return dbStorageSegmentChat.createUserChatListCustomFolder(this.segment(), userId, id, name, sortOrder);
  }

  async updateUserChatListCustomFolder(
    userId: string,
    folderId: string,
    patch: { name?: string; pushMuted?: boolean },
  ): Promise<boolean> {
    return dbStorageSegmentChat.updateUserChatListCustomFolder(this.segment(), userId, folderId, patch);
  }

  async deleteUserChatListCustomFolder(userId: string, folderId: string): Promise<boolean> {
    return dbStorageSegmentChat.deleteUserChatListCustomFolder(this.segment(), userId, folderId);
  }

  async resetUserChatMemberPrefsListSection(userId: string, fromSection: string, toSection: string): Promise<void> {
    return dbStorageSegmentChat.resetUserChatMemberPrefsListSection(this.segment(), userId, fromSection, toSection);
  }

  async upsertUserChatListBuiltinTabPrefs(
    userId: string,
    tabId: import("@shared/schema").ChatListSection,
    patch: { labelOverride?: string | null; pushMuted?: boolean },
  ): Promise<void> {
    return dbStorageSegmentChat.upsertUserChatListBuiltinTabPrefs(this.segment(), userId, tabId, patch);
  }

  async getOrCreateDmChat(userId: string, otherUserId: string): Promise<Chat> {
    return dbStorageSegmentChat.getOrCreateDmChat(this.segment(), userId, otherUserId);
  }

  async createChat(data: InsertChat): Promise<Chat> {
    return dbStorageSegmentChat.createChat(this.segment(), data);
  }

  async getChatByInviteCode(code: string): Promise<Chat | undefined> {
    return dbStorageSegmentChat.getChatByInviteCode(this.segment(), code);
  }

  async getChatByShortCode(code: string): Promise<Chat | undefined> {
    return dbStorageSegmentChat.getChatByShortCode(this.segment(), code);
  }

  async addChatMember(data: InsertChatMember): Promise<ChatMember> {
    return dbStorageSegmentChat.addChatMember(this.segment(), data);
  }

  async removeChatMember(chatId: string, userId: string): Promise<boolean> {
    return dbStorageSegmentChat.removeChatMember(this.segment(), chatId, userId);
  }

  async updateChat(
    chatId: string,
    data: {
      name?: string;
      avatarUrl?: string;
      shortCode?: string | null;
      inviteCode?: string | null;
      dmMultilingualEnabled?: boolean;
    },
  ): Promise<Chat | undefined> {
    return dbStorageSegmentChat.updateChat(this.segment(), chatId, data);
  }

  // ── Messages / folders / scheduled ─────────────────────────

  async updateLastRead(chatId: string, userId: string, readUpTo?: Date): Promise<void> {
    return dbStorageSegmentMessages.updateLastRead(this.segment(), chatId, userId, readUpTo);
  }

  async updateLastReadByMessageId(chatId: string, userId: string, messageId: string): Promise<void> {
    return dbStorageSegmentMessages.updateLastReadByMessageId(this.segment(), chatId, userId, messageId);
  }

  async getChatMemberLastReadAt(chatId: string, userId: string): Promise<Date | null> {
    return dbStorageSegmentMessages.getChatMemberLastReadAt(this.segment(), chatId, userId);
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    return dbStorageSegmentMessages.getUnreadCount(this.segment(), chatId, userId);
  }

  async getUnreadCountByFolder(chatId: string, folderId: string | null, userId: string): Promise<number> {
    return dbStorageSegmentMessages.getUnreadCountByFolder(this.segment(), chatId, folderId, userId);
  }

  async getMessageCountByFolder(chatId: string, folderId: string): Promise<number> {
    return dbStorageSegmentMessages.getMessageCountByFolder(this.segment(), chatId, folderId);
  }

  async getMessagesByChatId(
    chatId: string,
    limit = 100,
    beforeMessageId?: string,
    folderId?: string | null,
  ): Promise<Message[]> {
    return dbStorageSegmentMessages.getMessagesByChatId(this.segment(), chatId, limit, beforeMessageId, folderId);
  }

  async getMediaMessages(
    chatId: string,
    folderId: string | null,
    limit: number,
    beforeMessageId?: string,
  ): Promise<Message[]> {
    return dbStorageSegmentMessages.getMediaMessages(this.segment(), chatId, folderId, limit, beforeMessageId);
  }

  async getTextMessagesForLinks(
    chatId: string,
    folderId: string | null,
    limit: number,
    beforeMessageId?: string,
  ): Promise<Pick<Message, "id" | "content" | "createdAt">[]> {
    return dbStorageSegmentMessages.getTextMessagesForLinks(this.segment(), chatId, folderId, limit, beforeMessageId);
  }

  async listChatFolders(chatId: string): Promise<ChatFolder[]> {
    return dbStorageSegmentMessages.listChatFolders(this.segment(), chatId);
  }

  async getOrCreateMainFolder(chatId: string): Promise<ChatFolder> {
    return dbStorageSegmentMessages.getOrCreateMainFolder(this.segment(), chatId);
  }

  async createChatFolder(chatId: string, name: string, orderIndex: number): Promise<ChatFolder> {
    return dbStorageSegmentMessages.createChatFolder(this.segment(), chatId, name, orderIndex);
  }

  async getChatFolder(folderId: string): Promise<ChatFolder | undefined> {
    return dbStorageSegmentMessages.getChatFolder(this.segment(), folderId);
  }

  async updateChatFolder(folderId: string, data: { name?: string }): Promise<ChatFolder | undefined> {
    return dbStorageSegmentMessages.updateChatFolder(this.segment(), folderId, data);
  }

  async deleteChatFolder(folderId: string): Promise<boolean> {
    return dbStorageSegmentMessages.deleteChatFolder(this.segment(), folderId);
  }

  async getLastMessage(chatId: string): Promise<Message | undefined> {
    return dbStorageSegmentMessages.getLastMessage(this.segment(), chatId);
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    return dbStorageSegmentMessages.createMessage(this.segment(), data);
  }

  async getMessage(chatId: string, messageId: string): Promise<Message | undefined> {
    return dbStorageSegmentMessages.getMessage(this.segment(), chatId, messageId);
  }

  async getMessagesByIdsInChat(chatId: string, messageIds: string[]): Promise<Map<string, Message>> {
    return dbStorageSegmentMessages.getMessagesByIdsInChat(this.segment(), chatId, messageIds);
  }

  async getMessageById(messageId: string): Promise<Message | undefined> {
    return dbStorageSegmentMessages.getMessageById(this.segment(), messageId);
  }

  async deleteMessage(chatId: string, messageId: string): Promise<boolean> {
    return dbStorageSegmentMessages.deleteMessage(this.segment(), chatId, messageId);
  }

  async updateMessage(chatId: string, messageId: string, content: string): Promise<Message | undefined> {
    return dbStorageSegmentMessages.updateMessage(this.segment(), chatId, messageId, content);
  }

  async updateMessageTranscript(
    chatId: string,
    messageId: string,
    transcript: string,
  ): Promise<Message | undefined> {
    return dbStorageSegmentMessages.updateMessageTranscript(this.segment(), chatId, messageId, transcript);
  }

  async addMessageHidden(userId: string, chatId: string, messageId: string): Promise<void> {
    return dbStorageSegmentMessages.addMessageHidden(this.segment(), userId, chatId, messageId);
  }

  async getHiddenMessageIdsForUserInChat(userId: string, chatId: string): Promise<string[]> {
    return dbStorageSegmentMessages.getHiddenMessageIdsForUserInChat(this.segment(), userId, chatId);
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
    return dbStorageSegmentMessages.createScheduledMessage(this.segment(), data);
  }

  async getScheduledMessagesDue(limit: number): Promise<
    {
      id: string;
      chatId: string;
      folderId: string | null;
      senderId: string | null;
      type: string;
      content: string;
      replyToId: string | null;
    }[]
  > {
    return dbStorageSegmentMessages.getScheduledMessagesDue(this.segment(), limit);
  }

  async deleteScheduledMessage(id: string): Promise<boolean> {
    return dbStorageSegmentMessages.deleteScheduledMessage(this.segment(), id);
  }

  // ── Search / saved ─────────────────────────────────────────

  async searchMessages(
    userId: string,
    query: string,
    limit: number,
  ): Promise<{ messageId: string; chatId: string; type: string; content: string; createdAt: Date; chatName: string }[]> {
    return dbStorageSegmentSearchSaved.searchMessages(this.segment(), userId, query, limit);
  }

  async saveMessage(userId: string, messageId: string, chatId: string): Promise<void> {
    return dbStorageSegmentSearchSaved.saveMessage(this.segment(), userId, messageId, chatId);
  }

  async unsaveMessage(userId: string, messageId: string): Promise<void> {
    return dbStorageSegmentSearchSaved.unsaveMessage(this.segment(), userId, messageId);
  }

  async listSavedMessages(
    userId: string,
    limit: number,
    offset: number,
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
    return dbStorageSegmentSearchSaved.listSavedMessages(this.segment(), userId, limit, offset);
  }

  async isMessageSaved(userId: string, messageId: string): Promise<boolean> {
    return dbStorageSegmentSearchSaved.isMessageSaved(this.segment(), userId, messageId);
  }

  // ── Tracks ──────────────────────────────────────────────────

  async createTrack(userId: string, name: string): Promise<{ id: string; name: string; createdAt: Date }> {
    return dbStorageSegmentTracks.createTrack(this.segment(), userId, name);
  }

  async listTracks(
    userId: string,
  ): Promise<{ id: string; name: string; createdAt: Date; totalItems: number; activeItems: number; doneItems: number }[]> {
    return dbStorageSegmentTracks.listTracks(this.segment(), userId);
  }

  async getTrack(userId: string, trackId: string): Promise<{ id: string; name: string; createdAt: Date } | undefined> {
    return dbStorageSegmentTracks.getTrack(this.segment(), userId, trackId);
  }

  async addMessageToTrack(userId: string, trackId: string, messageId: string, chatId: string): Promise<void> {
    return dbStorageSegmentTracks.addMessageToTrack(this.segment(), userId, trackId, messageId, chatId);
  }

  async addCallSegmentToTrack(userId: string, trackId: string, segmentId: string): Promise<void> {
    return dbStorageSegmentTracks.addCallSegmentToTrack(this.segment(), userId, trackId, segmentId);
  }

  async removeTrackItem(userId: string, trackId: string, itemId: string): Promise<void> {
    return dbStorageSegmentTracks.removeTrackItem(this.segment(), userId, trackId, itemId);
  }

  async setTrackItemDone(userId: string, trackId: string, itemId: string, done: boolean): Promise<void> {
    return dbStorageSegmentTracks.setTrackItemDone(this.segment(), userId, trackId, itemId, done);
  }

  async updateTrack(userId: string, trackId: string, data: { name: string }): Promise<void> {
    return dbStorageSegmentTracks.updateTrack(this.segment(), userId, trackId, data);
  }

  async deleteTrack(userId: string, trackId: string): Promise<void> {
    return dbStorageSegmentTracks.deleteTrack(this.segment(), userId, trackId);
  }

  async getTracksStats(
    userId: string,
  ): Promise<{ totalTracks: number; activeItemsCount: number; doneItemsCount: number; lastAddedAt: Date | null }> {
    return dbStorageSegmentTracks.getTracksStats(this.segment(), userId);
  }

  async listTrackItems(
    userId: string,
    trackId: string,
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
    return dbStorageSegmentTracks.listTrackItems(this.segment(), userId, trackId);
  }

  // ── Calls / transcript ─────────────────────────────────────

  async createCallSessionHistory(data: {
    id: string;
    chatId: string;
    mediaType: "audio" | "video";
    createdByUserId: string;
  }) {
    return dbStorageSegmentCalls.createCallSessionHistory(this.segment(), data);
  }

  async endCallSessionHistory(callId: string): Promise<void> {
    return dbStorageSegmentCalls.endCallSessionHistory(this.segment(), callId);
  }

  async upsertCallParticipantHistory(callId: string, userId: string, displayNameSnapshot: string) {
    return dbStorageSegmentCalls.upsertCallParticipantHistory(this.segment(), callId, userId, displayNameSnapshot);
  }

  async markCallParticipantLeft(callId: string, userId: string): Promise<void> {
    return dbStorageSegmentCalls.markCallParticipantLeft(this.segment(), callId, userId);
  }

  async upsertCallTranscriptSegment(data: CallTranscriptSegmentUpsertInput): Promise<CallTranscriptSegment> {
    return dbStorageSegmentCalls.upsertCallTranscriptSegment(this.segment(), data);
  }

  async getCallTranscriptSegment(callId: string, segmentId: string): Promise<CallTranscriptSegment | undefined> {
    return dbStorageSegmentCalls.getCallTranscriptSegment(this.segment(), callId, segmentId);
  }

  async listCallTranscriptSegments(userId: string, callId: string): Promise<CallTranscriptSegment[]> {
    return dbStorageSegmentCalls.listCallTranscriptSegments(this.segment(), userId, callId);
  }

  async listCallSessionsHistory(
    userId: string,
  ): Promise<Array<typeof callSessionsHistory.$inferSelect & { participantCount: number; chatName: string }>> {
    return dbStorageSegmentCalls.listCallSessionsHistory(this.segment(), userId);
  }

  async createCallCommandSuggestion(data: {
    callId: string;
    segmentId?: string | null;
    intentType: string;
    title: string;
    payloadJson: string;
  }) {
    return dbStorageSegmentCalls.createCallCommandSuggestion(this.segment(), data);
  }

  async listCallCommandSuggestions(userId: string, callId: string) {
    return dbStorageSegmentCalls.listCallCommandSuggestions(this.segment(), userId, callId);
  }

  async resolveCallCommandSuggestion(
    userId: string,
    callId: string,
    suggestionId: string,
    status: "accepted" | "dismissed",
  ): Promise<void> {
    return dbStorageSegmentCalls.resolveCallCommandSuggestion(this.segment(), userId, callId, suggestionId, status);
  }

  // ── Social / profile ───────────────────────────────────────

  async updateUserProfile(userId: string, data: UpdateProfile): Promise<User | undefined> {
    return dbStorageSegmentSocial.updateUserProfile(this.segment(), userId, data);
  }

  async adminSetUserPublicId(
    userId: string,
    newPublicId: number,
  ): Promise<{ ok: true; user: User } | { ok: false; reason: "not_found" | "taken" | "invalid" }> {
    return dbStorageSegmentSocial.adminSetUserPublicId(this.segment(), userId, newPublicId);
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    return dbStorageSegmentSocial.updateUserLastSeen(this.segment(), userId);
  }

  async updateUserFcmToken(userId: string, token: string | null): Promise<void> {
    return dbStorageSegmentSocial.updateUserFcmToken(this.segment(), userId, token);
  }

  async updateUserIosVoipToken(userId: string, token: string | null): Promise<void> {
    return dbStorageSegmentSocial.updateUserIosVoipToken(this.segment(), userId, token);
  }

  async isContact(ownerId: string, contactUserId: string): Promise<boolean> {
    return dbStorageSegmentSocial.isContact(this.segment(), ownerId, contactUserId);
  }

  async addContact(ownerId: string, contactUserId: string): Promise<void> {
    return dbStorageSegmentSocial.addContact(this.segment(), ownerId, contactUserId);
  }

  async listContactUserIds(ownerId: string): Promise<string[]> {
    return dbStorageSegmentSocial.listContactUserIds(this.segment(), ownerId);
  }

  async addFollow(followerId: string, followingId: string): Promise<boolean> {
    return dbStorageSegmentSocial.addFollow(this.segment(), followerId, followingId);
  }

  async removeFollow(followerId: string, followingId: string): Promise<void> {
    return dbStorageSegmentSocial.removeFollow(this.segment(), followerId, followingId);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return dbStorageSegmentSocial.isFollowing(this.segment(), followerId, followingId);
  }

  async listFollowingIds(followerId: string): Promise<string[]> {
    return dbStorageSegmentSocial.listFollowingIds(this.segment(), followerId);
  }

  async listFollowerIds(userId: string): Promise<string[]> {
    return dbStorageSegmentSocial.listFollowerIds(this.segment(), userId);
  }

  async getFollowersCount(userId: string): Promise<number> {
    return dbStorageSegmentSocial.getFollowersCount(this.segment(), userId);
  }

  async getFollowingCount(userId: string): Promise<number> {
    return dbStorageSegmentSocial.getFollowingCount(this.segment(), userId);
  }

  async getFollowersList(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    return dbStorageSegmentSocial.getFollowersList(this.segment(), userId, limit, offset);
  }

  async getFollowingList(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    return dbStorageSegmentSocial.getFollowingList(this.segment(), userId, limit, offset);
  }

  async countMutualFollowingWhoFollowTarget(viewerId: string, targetUserId: string): Promise<number> {
    return dbStorageSegmentSocial.countMutualFollowingWhoFollowTarget(this.segment(), viewerId, targetUserId);
  }

  async listMutualFollowingWhoFollowTarget(
    viewerId: string,
    targetUserId: string,
    limit: number,
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    return dbStorageSegmentSocial.listMutualFollowingWhoFollowTarget(this.segment(), viewerId, targetUserId, limit);
  }

  async addBlock(
    blockerId: string,
    blockedId: string,
    flags?: Partial<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean }>,
    blockNote?: string | null,
  ): Promise<void> {
    return dbStorageSegmentSocial.addBlock(this.segment(), blockerId, blockedId, flags, blockNote);
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<void> {
    return dbStorageSegmentSocial.removeBlock(this.segment(), blockerId, blockedId);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return dbStorageSegmentSocial.isBlocked(this.segment(), blockerId, blockedId);
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
    return dbStorageSegmentSocial.getBlockFlags(this.segment(), blockerId, blockedId);
  }

  async getBlockedRelationIds(viewerId: string): Promise<string[]> {
    return dbStorageSegmentSocial.getBlockedRelationIds(this.segment(), viewerId);
  }

  // ── Vibe / planner / Pingok / DM calls ─────────────────────

  async getVibeState(chatId: string): Promise<ChatVibeState | undefined> {
    return dbStorageSegmentPlanner.getVibeState(this.segment(), chatId);
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
    },
  ): Promise<ChatVibeState> {
    return dbStorageSegmentPlanner.upsertVibeState(this.segment(), chatId, data);
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
    return dbStorageSegmentPlanner.createVibeBatch(this.segment(), data);
  }

  async getRecentVibeBatches(chatId: string, limit: number): Promise<ChatVibeBatch[]> {
    return dbStorageSegmentPlanner.getRecentVibeBatches(this.segment(), chatId, limit);
  }

  async createVibeHistoryEntry(data: {
    chatId: string;
    oldTheme: string;
    newTheme: string;
    oldConfidence: number;
    newConfidence: number;
    triggerType: string;
  }): Promise<ChatVibeHistoryEntry> {
    return dbStorageSegmentPlanner.createVibeHistoryEntry(this.segment(), data);
  }

  async createUserReminder(data: { userId: string; title: string; fireAt: Date }): Promise<UserReminder> {
    return dbStorageSegmentPlanner.createUserReminder(this.segment(), data);
  }

  async listDueUserReminders(userId: string, before: Date): Promise<UserReminder[]> {
    return dbStorageSegmentPlanner.listDueUserReminders(this.segment(), userId, before);
  }

  async dismissUserReminder(userId: string, id: string): Promise<boolean> {
    return dbStorageSegmentPlanner.dismissUserReminder(this.segment(), userId, id);
  }

  async updateUserReminderFireAt(userId: string, id: string, fireAt: Date): Promise<boolean> {
    return dbStorageSegmentPlanner.updateUserReminderFireAt(this.segment(), userId, id, fireAt);
  }

  async createVoiceTask(data: { userId: string; title: string }): Promise<VoiceTask> {
    return dbStorageSegmentPlanner.createVoiceTask(this.segment(), data);
  }

  async listOpenVoiceTasks(userId: string, limit: number): Promise<VoiceTask[]> {
    return dbStorageSegmentPlanner.listOpenVoiceTasks(this.segment(), userId, limit);
  }

  async completeVoiceTask(userId: string, id: string): Promise<boolean> {
    return dbStorageSegmentPlanner.completeVoiceTask(this.segment(), userId, id);
  }

  async ensurePingokTrackSourceChat(userId: string): Promise<Chat> {
    return dbStorageSegmentPlanner.ensurePingokTrackSourceChat(this.segment(), userId);
  }

  async findBestUserTrackByName(userId: string, nameQuery: string): Promise<{ id: string; name: string } | null> {
    return dbStorageSegmentTracks.findBestUserTrackByName(this.segment(), userId, nameQuery);
  }

  async createDmScheduledCall(data: {
    chatId: string;
    createdByUserId: string;
    peerUserId: string;
    fireAt: Date;
    title: string;
    plannerReminderId?: string | null;
  }): Promise<{ id: string }> {
    return dbStorageSegmentPlanner.createDmScheduledCall(this.segment(), data);
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
    return dbStorageSegmentPlanner.getActiveDmScheduledCallForChatMember(this.segment(), userId, chatId);
  }

  async dismissDmScheduledCallForChatMember(
    userId: string,
    chatId: string,
    rowId: string,
    options: { forBoth: boolean },
  ): Promise<boolean> {
    return dbStorageSegmentPlanner.dismissDmScheduledCallForChatMember(this.segment(), userId, chatId, rowId, options);
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
    return dbStorageSegmentPlanner.listPlannerActiveDmScheduledCalls(this.segment(), userId);
  }

  async updateDmScheduledCallFireAsPlanner(
    userId: string,
    rowId: string,
    fireAt: Date,
    title: string,
  ): Promise<{ chatId: string; peerUserId: string } | null> {
    return dbStorageSegmentPlanner.updateDmScheduledCallFireAsPlanner(this.segment(), userId, rowId, fireAt, title);
  }

  async cancelDmScheduledCallAsPlanner(
    userId: string,
    rowId: string,
  ): Promise<{ chatId: string; peerUserId: string } | null> {
    return dbStorageSegmentPlanner.cancelDmScheduledCallAsPlanner(this.segment(), userId, rowId);
  }

  async listDmScheduledCallsInPreEventWindow(userId: string): Promise<
    Array<{ id: string; chatId: string; title: string; fireAt: Date }>
  > {
    return dbStorageSegmentPlanner.listDmScheduledCallsInPreEventWindow(this.segment(), userId);
  }
}
