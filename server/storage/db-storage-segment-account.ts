/** Сегмент `DbStorage`: аккаунт, админка, рефералы. */
import type { User, InsertUser } from "@shared/schema";
import type { SignupRiskSummary } from "../admin/signup-risk";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageConsumeReferralCode,
  dbStorageCountReferralsByInviter,
  dbStorageCreateReferralCode,
  dbStorageCreateUser,
  dbStorageFindUsersDiscoverableByPhones,
  dbStorageGetAdminStats,
  dbStorageGetAdminUserSignupRiskSummaries,
  dbStorageGetNextPublicId,
  dbStorageGetReferralCodeByCode,
  dbStorageGetReferralCountsForUserIds,
  dbStorageGetUser,
  dbStorageGetUserByPhone,
  dbStorageGetUserByPublicId,
  dbStorageSetUserPasswordHash,
  dbStorageGetUsersPublicBriefByIds,
  dbStorageGetUserRegistrationsByDay,
  dbStorageListActiveReferralCodesByInviter,
  dbStorageListAdmins,
  dbStorageListInvitedUsers,
  dbStorageListUsersForAdmin,
  dbStorageListUsersRelatedBySignupSignals,
  dbStoragePurgeUserPermanently,
  dbStorageSearchUsers,
  dbStorageSetPlatformRole,
  dbStorageSetUserBlocked,
  dbStorageSetUserDeleted,
} from "./db-storage-facade-queries";

export const dbStorageSegmentAccount = {
  getUser(host: DbStorageSegmentHost, id: string): Promise<User | undefined> {
    return dbStorageGetUser(host.db, id);
  },

  getUserByPhone(host: DbStorageSegmentHost, phone: string): Promise<User | undefined> {
    return dbStorageGetUserByPhone(host.db, phone);
  },

  setUserPasswordHash(host: DbStorageSegmentHost, userId: string, passwordHash: string): Promise<boolean> {
    return dbStorageSetUserPasswordHash(host.db, userId, passwordHash);
  },

  findUsersDiscoverableByPhones(host: DbStorageSegmentHost, phones: string[], excludeUserId: string): Promise<User[]> {
    return dbStorageFindUsersDiscoverableByPhones(host.db, phones, excludeUserId);
  },

  searchUsers(host: DbStorageSegmentHost, query: string, excludeUserId: string): Promise<User[]> {
    return dbStorageSearchUsers(host.db, query, excludeUserId);
  },

  getNextPublicId(host: DbStorageSegmentHost): Promise<number> {
    return dbStorageGetNextPublicId(host.db);
  },

  createUser(host: DbStorageSegmentHost, data: InsertUser): Promise<User> {
    return dbStorageCreateUser(host.db, data);
  },

  listUsersRelatedBySignupSignals(
    host: DbStorageSegmentHost,
    userId: string,
    opts?: { limit?: number },
  ): Promise<{
    byDeviceId: User[];
    byIp: User[];
    byUaHash: User[];
    byClientSignalsHash: User[];
  }> {
    return dbStorageListUsersRelatedBySignupSignals(host.db, host.facadeCallbacks.getUser, userId, opts);
  },

  getAdminStats(host: DbStorageSegmentHost): Promise<{
    total: number;
    blocked: number;
    deleted: number;
    registeredToday: number;
  }> {
    return dbStorageGetAdminStats(host.db);
  },

  listUsersForAdmin(
    host: DbStorageSegmentHost,
    opts: {
      limit: number;
      offset: number;
      includeDeleted?: boolean;
      search?: string;
      sort?: "createdAt" | "referrals" | "invitedBy";
      sortDir?: "asc" | "desc";
    },
  ): Promise<{ users: User[]; total: number }> {
    return dbStorageListUsersForAdmin(host.db, opts);
  },

  getAdminUserSignupRiskSummaries(
    host: DbStorageSegmentHost,
    userIds: string[],
  ): Promise<Record<string, SignupRiskSummary>> {
    return dbStorageGetAdminUserSignupRiskSummaries(host.pool, userIds);
  },

  setUserBlocked(
    host: DbStorageSegmentHost,
    userId: string,
    blocked: boolean,
    opts?: { bannedBy: string; banReason?: string },
  ): Promise<User | undefined> {
    return dbStorageSetUserBlocked(host.db, userId, blocked, opts);
  },

  setUserDeleted(host: DbStorageSegmentHost, userId: string, deleted: boolean): Promise<User | undefined> {
    return dbStorageSetUserDeleted(host.db, userId, deleted);
  },

  purgeUserPermanently(host: DbStorageSegmentHost, userId: string): Promise<boolean> {
    return dbStoragePurgeUserPermanently(host.pool, userId);
  },

  setPlatformRole(host: DbStorageSegmentHost, userId: string, role: string): Promise<User | undefined> {
    return dbStorageSetPlatformRole(host.db, userId, role);
  },

  listAdmins(
    host: DbStorageSegmentHost,
  ): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "platformRole">[]> {
    return dbStorageListAdmins(host.db);
  },

  createReferralCode(
    host: DbStorageSegmentHost,
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
    return dbStorageCreateReferralCode(host.db, inviterUserId, code, expiresAt, opts);
  },

  getReferralCodeByCode(
    host: DbStorageSegmentHost,
    code: string,
  ): Promise<
    { id: string; inviterUserId: string; expiresAt: Date; bypassInviterLimit: boolean } | undefined
  > {
    return dbStorageGetReferralCodeByCode(host.db, code);
  },

  consumeReferralCode(host: DbStorageSegmentHost, codeId: string): Promise<boolean> {
    return dbStorageConsumeReferralCode(host.db, codeId);
  },

  countReferralsByInviter(host: DbStorageSegmentHost, inviterUserId: string): Promise<number> {
    return dbStorageCountReferralsByInviter(host.db, inviterUserId);
  },

  listActiveReferralCodesByInviter(
    host: DbStorageSegmentHost,
    inviterUserId: string,
  ): Promise<
    { id: string; code: string; expiresAt: Date; maxUses: number; useCount: number; adminNote: string | null }[]
  > {
    return dbStorageListActiveReferralCodesByInviter(host.db, inviterUserId);
  },

  getUserRegistrationsByDay(host: DbStorageSegmentHost, days: number): Promise<{ day: string; count: number }[]> {
    return dbStorageGetUserRegistrationsByDay(host.db, days);
  },

  listInvitedUsers(
    host: DbStorageSegmentHost,
    inviterUserId: string,
  ): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "avatarUrl" | "createdAt">[]> {
    return dbStorageListInvitedUsers(host.db, inviterUserId);
  },

  getReferralCountsForUserIds(host: DbStorageSegmentHost, userIds: string[]): Promise<Record<string, number>> {
    return dbStorageGetReferralCountsForUserIds(host.db, userIds);
  },

  getUsersPublicBriefByIds(
    host: DbStorageSegmentHost,
    userIds: string[],
  ): Promise<Record<string, { publicId: number; displayName: string | null; surname: string | null }>> {
    return dbStorageGetUsersPublicBriefByIds(host.db, userIds);
  },

  getUserByPublicId(host: DbStorageSegmentHost, publicId: number): Promise<User | undefined> {
    return dbStorageGetUserByPublicId(host.db, publicId);
  },
};
