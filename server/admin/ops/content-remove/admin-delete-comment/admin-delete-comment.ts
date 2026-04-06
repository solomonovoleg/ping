import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { postComments } from "@shared/schema";

export async function adminDeletePostComment(
  postId: string,
  commentId: string,
): Promise<{ ok: true } | { ok: false; status: 404 | 400 }> {
  const p = postId.trim();
  const c = commentId.trim();
  if (!p || !c) return { ok: false, status: 400 };
  const db = getDb();
  const [row] = await db
    .select({ id: postComments.id })
    .from(postComments)
    .where(and(eq(postComments.id, c), eq(postComments.postId, p)))
    .limit(1);
  if (!row) return { ok: false, status: 404 };
  await db.delete(postComments).where(eq(postComments.id, c));
  return { ok: true };
}
