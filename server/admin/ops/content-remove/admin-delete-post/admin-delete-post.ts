import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { posts, users } from "@shared/schema";
import { resolveCanonicalPostId } from "../../../../posts/resolve-post-ref";

/** Hard-delete by canonical id or link ref; clears pinnedPostId for author when applicable. */
export async function adminDeletePost(postRef: string): Promise<{ ok: true } | { ok: false; status: 404 }> {
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) return { ok: false, status: 404 };
  const db = getDb();
  const [existing] = await db.select({ id: posts.id, authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing) return { ok: false, status: 404 };
  await db
    .update(users)
    .set({ pinnedPostId: null })
    .where(and(eq(users.id, existing.authorId), eq(users.pinnedPostId, postId)));
  await db.delete(posts).where(eq(posts.id, postId));
  return { ok: true };
}
