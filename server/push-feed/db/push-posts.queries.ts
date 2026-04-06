import { and, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { posts, pushHiddenItems, pushPosts, pushSubscriptions, users } from "@shared/schema";
import type { PushTtlValue } from "@shared/schema";
import { getDb } from "../../db";
import { pushTtlExpiresAt } from "../validators/push-ttl";
import { PUSH_DAILY_WINDOW_MS } from "../constants/push-limits";

export async function countAuthorPushPostsInDailyWindow(authorId: string): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - PUSH_DAILY_WINDOW_MS);
  const [row] = await db
    .select({ value: count() })
    .from(pushPosts)
    .where(and(eq(pushPosts.authorId, authorId), gt(pushPosts.createdAt, since)));
  return Number(row?.value ?? 0) || 0;
}

export async function insertPushPost(params: { postId: string; authorId: string; ttl: PushTtlValue }): Promise<void> {
  const db = getDb();
  await db.insert(pushPosts).values({
    postId: params.postId,
    authorId: params.authorId,
    ttl: params.ttl,
    expiresAt: pushTtlExpiresAt(params.ttl),
  });
}

export async function selectPushFeedRows(userId: string, limit: number, offset: number) {
  const db = getDb();
  const now = new Date();
  return db
    .select({
      pushId: pushPosts.id,
      pushCreatedAt: pushPosts.createdAt,
      pushExpiresAt: pushPosts.expiresAt,
      pushTtl: pushPosts.ttl,
      postId: posts.id,
      postLinkCode: posts.linkCode,
      postText: posts.text,
      postImageUrl: posts.imageUrl,
      postMediaUrls: posts.mediaUrls,
      postCreatedAt: posts.createdAt,
      authorId: users.id,
      authorPublicId: users.publicId,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
      authorBusinessStatus: users.businessStatus,
      subscriptionNotificationsEnabled: pushSubscriptions.notificationsEnabled,
    })
    .from(pushSubscriptions)
    .innerJoin(pushPosts, eq(pushPosts.authorId, pushSubscriptions.authorId))
    .innerJoin(posts, eq(posts.id, pushPosts.postId))
    .innerJoin(users, eq(users.id, pushPosts.authorId))
    .leftJoin(
      pushHiddenItems,
      and(eq(pushHiddenItems.userId, pushSubscriptions.subscriberId), eq(pushHiddenItems.pushPostId, pushPosts.id)),
    )
    .where(
      and(
        eq(pushSubscriptions.subscriberId, userId),
        eq(pushSubscriptions.hidden, false),
        isNull(pushHiddenItems.pushPostId),
        or(isNull(pushPosts.expiresAt), gt(pushPosts.expiresAt, now)),
      ),
    )
    .orderBy(desc(pushPosts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function selectPushOutboxRows(authorId: string, limit: number, offset: number) {
  const db = getDb();
  return db
    .select({
      pushId: pushPosts.id,
      pushCreatedAt: pushPosts.createdAt,
      pushExpiresAt: pushPosts.expiresAt,
      pushTtl: pushPosts.ttl,
      postId: posts.id,
      postLinkCode: posts.linkCode,
      postText: posts.text,
      postImageUrl: posts.imageUrl,
      postMediaUrls: posts.mediaUrls,
      postCreatedAt: posts.createdAt,
      authorId: users.id,
      authorPublicId: users.publicId,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
      authorBusinessStatus: users.businessStatus,
      subscriptionNotificationsEnabled: pushSubscriptions.notificationsEnabled,
    })
    .from(pushPosts)
    .innerJoin(posts, eq(posts.id, pushPosts.postId))
    .innerJoin(users, eq(users.id, pushPosts.authorId))
    .leftJoin(
      pushSubscriptions,
      and(eq(pushSubscriptions.authorId, pushPosts.authorId), eq(pushSubscriptions.subscriberId, pushPosts.authorId)),
    )
    .where(eq(pushPosts.authorId, authorId))
    .orderBy(desc(pushPosts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function hidePushFeedItem(userId: string, pushPostId: string): Promise<void> {
  const db = getDb();
  await db.insert(pushHiddenItems).values({ userId, pushPostId }).onConflictDoNothing();
}
