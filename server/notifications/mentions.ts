import { getDb } from "../db";
import { notifications } from "@shared/schema";
import { extractMentions } from "@shared/schema/posts";
import type { IStorage } from "../storage/types";

/** Решить упоминание @id или @name в userId (или null) */
export async function resolveMentionToUserId(
  mention: string,
  storage: IStorage,
  excludeUserId: string
): Promise<string | null> {
  const m = mention.trim();
  if (!m) return null;
  if (/^\d+$/.test(m)) {
    const user = await storage.getUserByPublicId(parseInt(m, 10));
    return user && user.id !== excludeUserId && !user.deletedAt && !user.isBlocked ? user.id : null;
  }
  const list = await storage.searchUsers(m, excludeUserId);
  const exact = list.find(
    (u) =>
      [u.displayName, u.surname].filter(Boolean).join(" ").toLowerCase() === m.toLowerCase() ||
      (u.displayName?.toLowerCase() === m) ||
      String(u.publicId) === m
  );
  return exact ? exact.id : (list[0]?.id ?? null);
}

/** Создать уведомления «упоминание» для поста. authorId — кто написал пост. */
export async function notifyMentionsPost(
  postId: string,
  authorId: string,
  text: string,
  storage: IStorage
): Promise<void> {
  const mentions = extractMentions(text);
  if (mentions.length === 0) return;
  const db = getDb();
  const seen = new Set<string>();
  const excerpt = text.slice(0, 100);
  for (const m of mentions) {
    const userId = await resolveMentionToUserId(m, storage, authorId);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    try {
      await db.insert(notifications).values({
        userId,
        type: "mention",
        actorId: authorId,
        postId,
        excerpt,
        readAt: null,
      });
    } catch (e) {
      console.error("[notifications] mention post:", e);
    }
  }
}

/** Создать уведомления «упоминание» для комментария. */
export async function notifyMentionsComment(
  commentId: string,
  postId: string,
  authorId: string,
  text: string,
  storage: IStorage
): Promise<void> {
  const mentions = extractMentions(text);
  if (mentions.length === 0) return;
  const db = getDb();
  const seen = new Set<string>();
  const excerpt = text.slice(0, 100);
  for (const m of mentions) {
    const userId = await resolveMentionToUserId(m, storage, authorId);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    try {
      await db.insert(notifications).values({
        userId,
        type: "mention",
        actorId: authorId,
        postId,
        commentId,
        excerpt,
        readAt: null,
      });
    } catch (e) {
      console.error("[notifications] mention comment:", e);
    }
  }
}
