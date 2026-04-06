import { eq, or } from "drizzle-orm";
import { posts } from "@shared/schema";
import { getDb } from "../db";

/** Внутренний UUID поста по сегменту из URL: UUID или короткий `link_code`. */
export async function resolveCanonicalPostId(ref: string): Promise<string | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(or(eq(posts.id, trimmed), eq(posts.linkCode, trimmed)))
    .limit(1);
  return row?.id ?? null;
}
