import { postViews } from "@shared/schema";
import { getDb } from "../db";
import { resolveCanonicalPostId } from "./resolve-post-ref";

export async function recordPostView(postRef: string, userId: string): Promise<void> {
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) return;
  const db = getDb();
  await db.insert(postViews).values({ postId, userId }).onConflictDoNothing();
}

export type PostEngagementInput = {
  dwellMs?: number;
  expanded?: boolean;
  readFull?: boolean;
};

/** Сейчас пишем только уникальный просмотр; поля `engagement` зарезервированы под будущую схему. */
export async function recordPostEngagement(
  postRef: string,
  userId: string,
  _engagement: PostEngagementInput = {},
): Promise<void> {
  await recordPostView(postRef, userId);
}
