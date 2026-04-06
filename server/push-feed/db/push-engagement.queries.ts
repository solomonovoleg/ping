import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import {
  pushPostViews,
  pushPosts,
  pushReactions,
  pushReplies,
  pushSubscriptions,
  users,
} from "@shared/schema";
import type { PushReplyVisibility } from "@shared/schema";
import { getDb } from "../../db";

export async function upsertPushReaction(pushPostId: string, userId: string, emoji: string): Promise<void> {
  const db = getDb();
  await db
    .insert(pushReactions)
    .values({ pushPostId, userId, emoji: emoji.trim() || "❤️" })
    .onConflictDoUpdate({
      target: [pushReactions.pushPostId, pushReactions.userId],
      set: { emoji: emoji.trim() || "❤️", createdAt: new Date() },
    });
}

export async function removePushReaction(pushPostId: string, userId: string): Promise<void> {
  const db = getDb();
  await db.delete(pushReactions).where(and(eq(pushReactions.pushPostId, pushPostId), eq(pushReactions.userId, userId)));
}

export async function insertPushReply(params: {
  pushPostId: string;
  postId: string;
  authorId: string;
  pushAuthorId: string;
  visibility: PushReplyVisibility;
  text: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(pushReplies)
    .values({
      pushPostId: params.pushPostId,
      postId: params.postId,
      authorId: params.authorId,
      pushAuthorId: params.pushAuthorId,
      visibility: params.visibility,
      text: params.text.trim().slice(0, 8000),
    })
    .returning({
      id: pushReplies.id,
      createdAt: pushReplies.createdAt,
    });
  return row ?? null;
}

function pushRepliesVisibleWhere(pushPostId: string, viewerId: string, publicOnly: boolean) {
  const viewerScope = or(
    eq(pushReplies.visibility, "public"),
    eq(pushReplies.pushAuthorId, viewerId),
    eq(pushReplies.authorId, viewerId),
  );
  const clauses = [eq(pushReplies.pushPostId, pushPostId), viewerScope];
  if (publicOnly) clauses.push(eq(pushReplies.visibility, "public"));
  return and(...clauses);
}

export async function selectPushReplies(params: {
  pushPostId: string;
  viewerId: string;
  limit: number;
  offset: number;
  publicOnly?: boolean;
}) {
  const db = getDb();
  const publicOnly = params.publicOnly === true;
  return db
    .select({
      id: pushReplies.id,
      text: pushReplies.text,
      visibility: pushReplies.visibility,
      createdAt: pushReplies.createdAt,
      authorId: pushReplies.authorId,
      authorPublicId: users.publicId,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(pushReplies)
    .innerJoin(users, eq(users.id, pushReplies.authorId))
    .where(pushRepliesVisibleWhere(params.pushPostId, params.viewerId, publicOnly))
    .orderBy(desc(pushReplies.createdAt))
    .limit(params.limit)
    .offset(params.offset);
}

export async function countPushReplies(params: { pushPostId: string; viewerId: string; publicOnly?: boolean }): Promise<number> {
  const db = getDb();
  const publicOnly = params.publicOnly === true;
  const [row] = await db
    .select({ value: count() })
    .from(pushReplies)
    .where(pushRepliesVisibleWhere(params.pushPostId, params.viewerId, publicOnly));
  return Number(row?.value ?? 0) || 0;
}

export async function selectPushReactionCounts(pushPostIds: string[]): Promise<Map<string, number>> {
  const ids = pushPostIds.filter((id) => id.trim().length > 0);
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({ pushPostId: pushReactions.pushPostId, value: count() })
    .from(pushReactions)
    .where(inArray(pushReactions.pushPostId, ids))
    .groupBy(pushReactions.pushPostId);
  for (const row of rows) out.set(row.pushPostId, Number(row.value ?? 0) || 0);
  return out;
}

export async function selectPushReplyCounts(pushPostIds: string[]): Promise<Map<string, number>> {
  const ids = pushPostIds.filter((id) => id.trim().length > 0);
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({ pushPostId: pushReplies.pushPostId, value: count() })
    .from(pushReplies)
    .where(inArray(pushReplies.pushPostId, ids))
    .groupBy(pushReplies.pushPostId);
  for (const row of rows) out.set(row.pushPostId, Number(row.value ?? 0) || 0);
  return out;
}

/** Число уникальных зрителей (строк в push_post_views) на каждый push. */
export async function selectPushUniqueViewCounts(pushPostIds: string[]): Promise<Map<string, number>> {
  const ids = pushPostIds.filter((id) => id.trim().length > 0);
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({ pushPostId: pushPostViews.pushPostId, value: count() })
    .from(pushPostViews)
    .where(inArray(pushPostViews.pushPostId, ids))
    .groupBy(pushPostViews.pushPostId);
  for (const row of rows) out.set(row.pushPostId, Number(row.value ?? 0) || 0);
  return out;
}

export type RecordPushPostViewResult =
  | "recorded"
  | "duplicate"
  | "skipped_author"
  | "skipped_expired"
  | "not_found"
  | "forbidden";

export async function recordPushPostView(params: {
  pushPostId: string;
  viewerUserId: string;
}): Promise<RecordPushPostViewResult> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({
      authorId: pushPosts.authorId,
      expiresAt: pushPosts.expiresAt,
    })
    .from(pushPosts)
    .where(eq(pushPosts.id, params.pushPostId))
    .limit(1);
  if (!row) return "not_found";
  if (row.authorId === params.viewerUserId) return "skipped_author";
  if (row.expiresAt && row.expiresAt <= now) return "skipped_expired";

  const [sub] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.subscriberId, params.viewerUserId),
        eq(pushSubscriptions.authorId, row.authorId),
        eq(pushSubscriptions.hidden, false),
      ),
    )
    .limit(1);
  if (!sub) return "forbidden";

  const inserted = await db
    .insert(pushPostViews)
    .values({ pushPostId: params.pushPostId, userId: params.viewerUserId })
    .onConflictDoNothing()
    .returning({ pushPostId: pushPostViews.pushPostId });

  return inserted.length > 0 ? "recorded" : "duplicate";
}

export async function selectLatestPushReplies(pushPostIds: string[], viewerId: string) {
  const ids = pushPostIds.filter((id) => id.trim().length > 0);
  const out = new Map<string, {
    id: string;
    text: string;
    visibility: string;
    createdAt: Date | null;
    authorId: string;
    authorPublicId: number | null;
    authorDisplayName: string | null;
    authorSurname: string | null;
    authorAvatarUrl: string | null;
  }>();
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({
      id: pushReplies.id,
      pushPostId: pushReplies.pushPostId,
      text: pushReplies.text,
      visibility: pushReplies.visibility,
      createdAt: pushReplies.createdAt,
      authorId: pushReplies.authorId,
      authorPublicId: users.publicId,
      authorDisplayName: users.displayName,
      authorSurname: users.surname,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(pushReplies)
    .innerJoin(users, eq(users.id, pushReplies.authorId))
    .where(
      and(
        inArray(pushReplies.pushPostId, ids),
        or(eq(pushReplies.visibility, "public"), eq(pushReplies.pushAuthorId, viewerId), eq(pushReplies.authorId, viewerId)),
      ),
    )
    .orderBy(desc(pushReplies.createdAt));
  for (const row of rows) {
    if (!out.has(row.pushPostId)) {
      out.set(row.pushPostId, row);
    }
  }
  return out;
}

export async function selectPushPostOwner(pushPostId: string): Promise<{ postId: string; authorId: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ postId: pushPosts.postId, authorId: pushPosts.authorId })
    .from(pushPosts)
    .where(eq(pushPosts.id, pushPostId))
    .limit(1);
  return row ?? null;
}

/** Реакция текущего пользователя на каждый push (для ленты / исходящих). */
export async function selectViewerPushReactionEmojisByPostIds(
  pushPostIds: string[],
  viewerId: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(pushPostIds.filter(Boolean))];
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({ pushPostId: pushReactions.pushPostId, emoji: pushReactions.emoji })
    .from(pushReactions)
    .where(and(inArray(pushReactions.pushPostId, ids), eq(pushReactions.userId, viewerId)));
  for (const row of rows) {
    out.set(row.pushPostId, row.emoji);
  }
  return out;
}
