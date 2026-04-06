import { eq, and, desc, sql } from "drizzle-orm";
import { users, contacts, follows } from "@shared/schema";
import { pluckContactUserIds, pluckFollowerIds, pluckFollowingIds } from "./db-storage-follow-row-pluck";
import { mutualFollowToTargetJoinBundle } from "./db-storage-mutual-follow-to-target";
import { followListPublicUserSelect } from "./db-storage-follow-list-user-columns";
import type { AppDb } from "./db-app-db";

export async function dbStorageIsContact(db: AppDb, ownerId: string, contactUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.userId, ownerId), eq(contacts.contactUserId, contactUserId)))
    .limit(1);
  return !!row;
}

export async function dbStorageAddContact(db: AppDb, ownerId: string, contactUserId: string): Promise<void> {
  const existing = await dbStorageIsContact(db, ownerId, contactUserId);
  if (existing) return;
  await db.insert(contacts).values({ userId: ownerId, contactUserId });
}

export async function dbStorageListContactUserIds(db: AppDb, ownerId: string): Promise<string[]> {
  const rows = await db
    .select({ contactUserId: contacts.contactUserId })
    .from(contacts)
    .where(eq(contacts.userId, ownerId));
  return pluckContactUserIds(rows);
}

export async function dbStorageAddFollow(db: AppDb, followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return false;
  const existing = await dbStorageIsFollowing(db, followerId, followingId);
  if (existing) return false;
  await db.insert(follows).values({ followerId, followingId });
  return true;
}

export async function dbStorageRemoveFollow(db: AppDb, followerId: string, followingId: string): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
}

export async function dbStorageIsFollowing(db: AppDb, followerId: string, followingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return !!row;
}

export async function dbStorageListFollowingIds(db: AppDb, followerId: string): Promise<string[]> {
  const rows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, followerId));
  return pluckFollowingIds(rows);
}

export async function dbStorageListFollowerIds(db: AppDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return pluckFollowerIds(rows);
}

export async function dbStorageGetFollowersCount(db: AppDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return row?.count ?? 0;
}

export async function dbStorageGetFollowingCount(db: AppDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return row?.count ?? 0;
}

export async function dbStorageGetFollowersList(
  db: AppDb,
  userId: string,
  limit: number,
  offset: number,
): Promise<
  { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]
> {
  const rows = await db
    .select(followListPublicUserSelect)
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function dbStorageGetFollowingList(
  db: AppDb,
  userId: string,
  limit: number,
  offset: number,
): Promise<
  { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]
> {
  const rows = await db
    .select(followListPublicUserSelect)
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function dbStorageCountMutualFollowingWhoFollowTarget(
  db: AppDb,
  viewerId: string,
  targetUserId: string,
): Promise<number> {
  const { fViewer, fMutual, baseWhere } = mutualFollowToTargetJoinBundle(viewerId, targetUserId);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fViewer)
    .innerJoin(fMutual, eq(fViewer.followingId, fMutual.followerId))
    .innerJoin(users, eq(users.id, fViewer.followingId))
    .where(baseWhere);
  return row?.count ?? 0;
}

export async function dbStorageListMutualFollowingWhoFollowTarget(
  db: AppDb,
  viewerId: string,
  targetUserId: string,
  limit: number,
): Promise<
  { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]
> {
  const { fViewer, fMutual, baseWhere } = mutualFollowToTargetJoinBundle(viewerId, targetUserId);
  const rows = await db
    .select(followListPublicUserSelect)
    .from(fViewer)
    .innerJoin(fMutual, eq(fViewer.followingId, fMutual.followerId))
    .innerJoin(users, eq(users.id, fViewer.followingId))
    .where(baseWhere)
    .orderBy(desc(fMutual.createdAt))
    .limit(Math.min(Math.max(limit, 1), 20));
  return rows;
}
