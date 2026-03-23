import { and, eq, sql } from "drizzle-orm";
import type { PresetVerify } from "@shared/edge-task-preset-config";
import { postComments, postReactions, posts } from "@shared/schema";
import { getDb } from "../db";
import { storage } from "../storage";

async function countUserPostsPublished(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.isDraft, false)));
  const n = rows[0]?.c;
  return typeof n === "number" ? n : Number(n) || 0;
}

async function countUserComments(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(postComments)
    .where(eq(postComments.userId, userId));
  const n = rows[0]?.c;
  return typeof n === "number" ? n : Number(n) || 0;
}

async function countUserReactions(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(postReactions)
    .where(eq(postReactions.userId, userId));
  const n = rows[0]?.c;
  return typeof n === "number" ? n : Number(n) || 0;
}

/**
 * Проверка пресет-задания по данным платформы (подписка, реакция, комментарий к посту кампании).
 */
export async function verifyPresetOnPlatform(opts: {
  userId: string;
  edgeId: string;
  creatorPlatformUserId: string | null;
  verify: PresetVerify;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { userId, edgeId, creatorPlatformUserId, verify } = opts;

  if (verify.type === "honor") return { ok: true };

  if (verify.type === "follow_creator") {
    const creator = creatorPlatformUserId?.trim() ?? "";
    if (!creator) return { ok: false, reason: "creator_unknown" };
    if (creator === userId) return { ok: true };
    const following = await storage.isFollowing(userId, creator);
    if (!following) return { ok: false, reason: "not_following_creator" };
    return { ok: true };
  }

  if (verify.type === "react_post") {
    const db = getDb();
    const [postRow] = await db
      .select({ id: posts.id, edgeId: posts.edgeId })
      .from(posts)
      .where(eq(posts.id, verify.postId))
      .limit(1);
    if (!postRow) return { ok: false, reason: "post_not_found" };
    if ((postRow.edgeId ?? "").trim() !== edgeId.trim()) {
      return { ok: false, reason: "post_not_in_campaign" };
    }
    const [rx] = await db
      .select({ postId: postReactions.postId })
      .from(postReactions)
      .where(and(eq(postReactions.postId, verify.postId), eq(postReactions.userId, userId)))
      .limit(1);
    if (!rx) return { ok: false, reason: "no_reaction" };
    return { ok: true };
  }

  if (verify.type === "comment_post") {
    const db = getDb();
    const [postRow] = await db
      .select({ id: posts.id, edgeId: posts.edgeId })
      .from(posts)
      .where(eq(posts.id, verify.postId))
      .limit(1);
    if (!postRow) return { ok: false, reason: "post_not_found" };
    if ((postRow.edgeId ?? "").trim() !== edgeId.trim()) {
      return { ok: false, reason: "post_not_in_campaign" };
    }
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(postComments)
      .where(and(eq(postComments.postId, verify.postId), eq(postComments.userId, userId)));
    const c = rows[0]?.c;
    const n = typeof c === "number" ? c : Number(c);
    if (!Number.isFinite(n) || n < verify.minCount) {
      return { ok: false, reason: "not_enough_comments" };
    }
    return { ok: true };
  }

  if (verify.type === "ping_invited_users") {
    const invited = await storage.listInvitedUsers(userId);
    if (invited.length < verify.minCount) {
      return { ok: false, reason: "not_enough_invites" };
    }
    return { ok: true };
  }

  if (verify.type === "ping_posts_published") {
    const c = await countUserPostsPublished(userId);
    if (c < verify.minCount) return { ok: false, reason: "not_enough_posts" };
    return { ok: true };
  }

  if (verify.type === "ping_profile_complete") {
    const u = await storage.getUser(userId);
    if (!u) return { ok: false, reason: "user_not_found" };
    const hasBirth = Boolean(u.birthDate && String(u.birthDate).trim());
    const hasGender = Boolean(u.gender && String(u.gender).trim());
    const hasAvatar = Boolean(u.avatarUrl && String(u.avatarUrl).trim());
    if (!hasBirth || !hasGender || !hasAvatar) {
      return { ok: false, reason: "profile_incomplete" };
    }
    return { ok: true };
  }

  if (verify.type === "ping_comments_count") {
    const c = await countUserComments(userId);
    if (c < verify.minCount) return { ok: false, reason: "not_enough_comments_global" };
    return { ok: true };
  }

  if (verify.type === "ping_reactions_count") {
    const c = await countUserReactions(userId);
    if (c < verify.minCount) return { ok: false, reason: "not_enough_reactions_global" };
    return { ok: true };
  }

  return { ok: true };
}
