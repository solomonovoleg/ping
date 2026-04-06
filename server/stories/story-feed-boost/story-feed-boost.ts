import { and, eq, gt } from "drizzle-orm";
import { stories } from "@shared/schema";
import { getDb } from "../../db";
import { ensureStoriesFeedBoostColumns } from "../../db";

/** Буст от лайка — короче (меньше «веса» в ленте). */
export const STORY_FEED_LIKE_BOOST_MS = 5 * 60 * 1000;
/** Буст от ответа на сториз в чате — дольше и сильнее влияет на порядок. */
export const STORY_FEED_REPLY_BOOST_MS = 15 * 60 * 1000;

type StoryFeedRow = {
  createdAt: Date;
  feedBoostLikeAt: Date | null;
  feedBoostReplyAt: Date | null;
};

export function authorFeedRankMs(authorStories: StoryFeedRow[], nowMs: number): number {
  let latestCreated = 0;
  let bestLikeBoost = 0;
  let bestReplyBoost = 0;
  for (const s of authorStories) {
    const c = s.createdAt?.getTime?.() ?? 0;
    if (c > latestCreated) latestCreated = c;
    const lk = s.feedBoostLikeAt?.getTime?.() ?? 0;
    if (lk > 0 && nowMs < lk + STORY_FEED_LIKE_BOOST_MS && lk > bestLikeBoost) bestLikeBoost = lk;
    const rp = s.feedBoostReplyAt?.getTime?.() ?? 0;
    if (rp > 0 && nowMs < rp + STORY_FEED_REPLY_BOOST_MS && rp > bestReplyBoost) bestReplyBoost = rp;
  }
  return Math.max(latestCreated, bestLikeBoost, bestReplyBoost);
}

export async function touchStoryFeedBoostLike(storyId: string): Promise<void> {
  await ensureStoriesFeedBoostColumns();
  const db = getDb();
  const now = new Date();
  await db
    .update(stories)
    .set({ feedBoostLikeAt: now })
    .where(and(eq(stories.id, storyId), gt(stories.expiresAt, now)));
}

export async function touchStoryFeedBoostReply(storyId: string): Promise<void> {
  await ensureStoriesFeedBoostColumns();
  const db = getDb();
  const now = new Date();
  await db
    .update(stories)
    .set({ feedBoostReplyAt: now })
    .where(and(eq(stories.id, storyId), gt(stories.expiresAt, now)));
}
