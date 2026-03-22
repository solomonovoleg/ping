import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import type { FeedPost } from "@/lib/posts";

/** Часть queryKey бесконечной ленты (`["posts", "feed", hashtag]`) */
const FEED_PREFIX = ["posts", "feed"] as const;

function isInfiniteFeedData(old: unknown): old is InfiniteData<FeedPost[]> {
  return (
    !!old &&
    typeof old === "object" &&
    "pages" in old &&
    Array.isArray((old as InfiniteData<FeedPost[]>).pages)
  );
}

/** Обновить один пост во всех закэшированных страницах ленты (любой хештег). */
export function updateFeedPostInCache(
  queryClient: QueryClient,
  postId: string,
  updater: (post: FeedPost) => FeedPost,
): void {
  queryClient.setQueriesData({ queryKey: [...FEED_PREFIX] }, (old) => {
    if (!isInfiniteFeedData(old)) return old;
    let changed = false;
    const pages = old.pages.map((page) =>
      page.map((p) => {
        if (p.id !== postId) return p;
        changed = true;
        return updater(p);
      }),
    );
    if (!changed) return old;
    return { ...old, pages };
  });
}

/** Оптимистично применить смену реакции к снимку поста (счётчики + myReaction). */
export function applyReactionOptimistic(post: FeedPost, emoji: string | null): FeedPost {
  const prevMy = post.myReaction ?? null;
  const nextMy = emoji;
  const reactions = [...(post.reactions ?? [])];
  const adjust = (e: string, delta: number) => {
    const idx = reactions.findIndex((r) => r.emoji === e);
    if (idx >= 0) {
      const nextCount = reactions[idx].count + delta;
      if (nextCount <= 0) reactions.splice(idx, 1);
      else reactions[idx] = { emoji: e, count: nextCount };
    } else if (delta > 0) {
      reactions.push({ emoji: e, count: delta });
    }
  };
  if (prevMy) adjust(prevMy, -1);
  if (nextMy) adjust(nextMy, 1);
  return { ...post, myReaction: nextMy, reactions };
}
