/** Локально скрытые посты в ленте (только этот браузер / устройство). */
const MAX_IDS = 400;

export function feedHiddenPostIdsStorageKey(userId: string | undefined): string {
  return `ping.feed.hiddenPostIds.v1:${userId ?? "guest"}`;
}

export function loadHiddenFeedPostIds(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string").slice(-MAX_IDS));
  } catch {
    return new Set();
  }
}

export function persistHiddenFeedPostIds(storageKey: string, ids: Set<string>): void {
  const arr = [...ids].slice(-MAX_IDS);
  try {
    localStorage.setItem(storageKey, JSON.stringify(arr));
  } catch {
    /* ignore quota */
  }
}

export function withHiddenFeedPostId(ids: Set<string>, postId: string): Set<string> {
  const next = new Set(ids);
  next.add(postId);
  if (next.size <= MAX_IDS) return next;
  const list = [...next];
  return new Set(list.slice(list.length - MAX_IDS));
}
