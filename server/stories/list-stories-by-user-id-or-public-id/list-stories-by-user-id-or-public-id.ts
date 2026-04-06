import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { getDb } from "../../db";
import { getStoriesByAuthorId } from "../get-stories-by-author-id/get-stories-by-author-id";
import type { StoryRow } from "../stories-types/stories-types";

export async function listStoriesByUserIdOrPublicId(userIdParam: string, viewerId?: string): Promise<StoryRow[]> {
  const db = getDb();
  let authorId: string | null = null;
  if (/^\d+$/.test(userIdParam)) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.publicId, parseInt(userIdParam, 10)))
      .limit(1);
    authorId = u?.id ?? null;
  } else {
    authorId = userIdParam;
  }
  if (!authorId) return [];
  return getStoriesByAuthorId(authorId, viewerId);
}
