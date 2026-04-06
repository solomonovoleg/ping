import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { stories } from "@shared/schema";

export async function adminDeleteStory(storyId: string): Promise<{ ok: true } | { ok: false; status: 404 }> {
  const id = storyId.trim();
  if (!id) return { ok: false, status: 404 };
  const db = getDb();
  const [row] = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, id)).limit(1);
  if (!row) return { ok: false, status: 404 };
  await db.delete(stories).where(eq(stories.id, id));
  return { ok: true };
}
