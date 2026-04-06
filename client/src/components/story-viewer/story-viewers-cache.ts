import { fetchStoryViewers, type StoryViewerUser } from "@/lib/stories";

const TTL_MS = 55_000;
const cache = new Map<string, { at: number; data: StoryViewerUser[] }>();
const inflight = new Map<string, Promise<StoryViewerUser[]>>();

/**
 * Зрители сториз: короткий кэш + дедуп запросов на время сессии просмотра.
 */
export function fetchStoryViewersCached(storyId: string): Promise<StoryViewerUser[]> {
  const now = Date.now();
  const hit = cache.get(storyId);
  if (hit && now - hit.at < TTL_MS) {
    return Promise.resolve(hit.data);
  }
  const pending = inflight.get(storyId);
  if (pending) return pending;

  const p = fetchStoryViewers(storyId)
    .then((list) => {
      const data = Array.isArray(list) ? list : [];
      cache.set(storyId, { at: Date.now(), data });
      return data;
    })
    .catch(() => [] as StoryViewerUser[])
    .finally(() => {
      inflight.delete(storyId);
    });

  inflight.set(storyId, p);
  return p;
}
