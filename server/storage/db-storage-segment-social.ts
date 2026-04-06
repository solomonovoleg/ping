/** Сегмент `DbStorage`: профиль/presence, контакты, подписки, блокировки. */
import type { User, UpdateProfile } from "@shared/schema";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageAddBlock,
  dbStorageAddContact,
  dbStorageAddFollow,
  dbStorageCountMutualFollowingWhoFollowTarget,
  dbStorageGetBlockFlags,
  dbStorageGetBlockedRelationIds,
  dbStorageGetFollowersCount,
  dbStorageGetFollowersList,
  dbStorageGetFollowingCount,
  dbStorageGetFollowingList,
  dbStorageIsBlocked,
  dbStorageIsContact,
  dbStorageIsFollowing,
  dbStorageListContactUserIds,
  dbStorageListFollowerIds,
  dbStorageListFollowingIds,
  dbStorageListMutualFollowingWhoFollowTarget,
  dbStorageRemoveBlock,
  dbStorageRemoveFollow,
  dbStorageAdminSetUserPublicId,
  dbStorageUpdateUserFcmToken,
  dbStorageUpdateUserIosVoipToken,
  dbStorageUpdateUserLastSeen,
  dbStorageUpdateUserProfile,
} from "./db-storage-facade-queries";

export const dbStorageSegmentSocial = {
  adminSetUserPublicId(host: DbStorageSegmentHost, userId: string, newPublicId: number) {
    return dbStorageAdminSetUserPublicId(host.db, userId, newPublicId);
  },

  updateUserProfile(host: DbStorageSegmentHost, userId: string, data: UpdateProfile): Promise<User | undefined> {
    return dbStorageUpdateUserProfile(host.db, userId, data, host.facadeCallbacks.getUser);
  },

  updateUserLastSeen(host: DbStorageSegmentHost, userId: string): Promise<void> {
    return dbStorageUpdateUserLastSeen(host.db, userId);
  },

  updateUserFcmToken(host: DbStorageSegmentHost, userId: string, token: string | null): Promise<void> {
    return dbStorageUpdateUserFcmToken(host.db, userId, token);
  },

  updateUserIosVoipToken(host: DbStorageSegmentHost, userId: string, token: string | null): Promise<void> {
    return dbStorageUpdateUserIosVoipToken(host.db, userId, token);
  },

  isContact(host: DbStorageSegmentHost, ownerId: string, contactUserId: string): Promise<boolean> {
    return dbStorageIsContact(host.db, ownerId, contactUserId);
  },

  addContact(host: DbStorageSegmentHost, ownerId: string, contactUserId: string): Promise<void> {
    return dbStorageAddContact(host.db, ownerId, contactUserId);
  },

  listContactUserIds(host: DbStorageSegmentHost, ownerId: string): Promise<string[]> {
    return dbStorageListContactUserIds(host.db, ownerId);
  },

  addFollow(host: DbStorageSegmentHost, followerId: string, followingId: string): Promise<boolean> {
    return dbStorageAddFollow(host.db, followerId, followingId);
  },

  removeFollow(host: DbStorageSegmentHost, followerId: string, followingId: string): Promise<void> {
    return dbStorageRemoveFollow(host.db, followerId, followingId);
  },

  isFollowing(host: DbStorageSegmentHost, followerId: string, followingId: string): Promise<boolean> {
    return dbStorageIsFollowing(host.db, followerId, followingId);
  },

  listFollowingIds(host: DbStorageSegmentHost, followerId: string): Promise<string[]> {
    return dbStorageListFollowingIds(host.db, followerId);
  },

  listFollowerIds(host: DbStorageSegmentHost, userId: string): Promise<string[]> {
    return dbStorageListFollowerIds(host.db, userId);
  },

  getFollowersCount(host: DbStorageSegmentHost, userId: string): Promise<number> {
    return dbStorageGetFollowersCount(host.db, userId);
  },

  getFollowingCount(host: DbStorageSegmentHost, userId: string): Promise<number> {
    return dbStorageGetFollowingCount(host.db, userId);
  },

  getFollowersList(
    host: DbStorageSegmentHost,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    return dbStorageGetFollowersList(host.db, userId, limit, offset);
  },

  getFollowingList(
    host: DbStorageSegmentHost,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    return dbStorageGetFollowingList(host.db, userId, limit, offset);
  },

  countMutualFollowingWhoFollowTarget(host: DbStorageSegmentHost, viewerId: string, targetUserId: string): Promise<number> {
    return dbStorageCountMutualFollowingWhoFollowTarget(host.db, viewerId, targetUserId);
  },

  listMutualFollowingWhoFollowTarget(
    host: DbStorageSegmentHost,
    viewerId: string,
    targetUserId: string,
    limit: number,
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]> {
    return dbStorageListMutualFollowingWhoFollowTarget(host.db, viewerId, targetUserId, limit);
  },

  addBlock(
    host: DbStorageSegmentHost,
    blockerId: string,
    blockedId: string,
    flags?: Partial<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean }>,
    blockNote?: string | null,
  ): Promise<void> {
    return dbStorageAddBlock(host.db, blockerId, blockedId, flags, blockNote);
  },

  removeBlock(host: DbStorageSegmentHost, blockerId: string, blockedId: string): Promise<void> {
    return dbStorageRemoveBlock(host.db, blockerId, blockedId);
  },

  isBlocked(host: DbStorageSegmentHost, blockerId: string, blockedId: string): Promise<boolean> {
    return dbStorageIsBlocked(host.db, blockerId, blockedId);
  },

  getBlockFlags(
    host: DbStorageSegmentHost,
    blockerId: string,
    blockedId: string,
  ): Promise<{
    restrictProfile: boolean;
    restrictChat: boolean;
    restrictSocial: boolean;
    blockNote: string | null;
  } | null> {
    return dbStorageGetBlockFlags(host.db, blockerId, blockedId);
  },

  getBlockedRelationIds(host: DbStorageSegmentHost, viewerId: string): Promise<string[]> {
    return dbStorageGetBlockedRelationIds(host.db, viewerId);
  },
};
