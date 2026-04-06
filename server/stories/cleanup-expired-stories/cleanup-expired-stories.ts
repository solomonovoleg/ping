import { lt } from "drizzle-orm";
import { stories } from "@shared/schema";
import { getDb } from "../../db";

/** Удаляет сториз, истёкшие более 30 дней назад. */
export async function cleanupExpiredStories(): Promise<number> {
  const db = getDb();
  const now = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(stories)
    .where(lt(stories.expiresAt, now))
    .returning({ id: stories.id });
  return deleted.length;
}
