import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { notifications, posts } from "@shared/schema";

/** Уведомление автору поста о новом комментарии (если комментатор не автор поста). */
export async function notifyComment(
  postId: string,
  commentId: string,
  actorId: string,
  excerpt: string
): Promise<void> {
  const db = getDb();
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.authorId === actorId) return;
  try {
    await db.insert(notifications).values({
      userId: post.authorId,
      type: "comment",
      actorId,
      postId,
      commentId,
      excerpt: excerpt.slice(0, 200),
    });
  } catch (e) {
    console.error("[notifications] comment:", e);
  }
}

/** Уведомление автору поста о реакции (лайк и т.д.), если поставивший не автор. */
export async function notifyReaction(postId: string, actorId: string, emoji: string): Promise<void> {
  const db = getDb();
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.authorId === actorId) return;
  try {
    await db.insert(notifications).values({
      userId: post.authorId,
      type: "reaction",
      actorId,
      postId,
      excerpt: emoji,
    });
  } catch (e) {
    console.error("[notifications] reaction:", e);
  }
}

/** Уведомление пользователю о новой подписке на него. */
export async function notifyFollow(targetUserId: string, actorId: string): Promise<void> {
  if (targetUserId === actorId) return;
  const db = getDb();
  try {
    await db.insert(notifications).values({
      userId: targetUserId,
      type: "follow",
      actorId,
    });
  } catch (e) {
    console.error("[notifications] follow:", e);
  }
}
