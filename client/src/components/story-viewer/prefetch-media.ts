import { isLikelyStoryVideoUrl } from "@/lib/story-media";

const seen = new Set<string>();
const headLinks: HTMLLinkElement[] = [];
const MAX_LINK_TAGS = 10;

/**
 * Дедуп префетча соседних сториз: меньше повторных запросов и парсинга.
 */
export function prefetchStoryMediaUrl(url: string | undefined): void {
  if (!url || seen.has(url)) return;
  seen.add(url);

  try {
    if (isLikelyStoryVideoUrl(url)) {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.src = url;
      return;
    }
    if (typeof document === "undefined") return;
    if (headLinks.length < MAX_LINK_TAGS) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.fetchPriority = "low";
      document.head.appendChild(link);
      headLinks.push(link);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  } catch {
    /* ignore */
  }
}

export function prefetchStoryMediaLowPriority(
  story: { image?: string; thumbnailUrl?: string } | undefined
): void {
  if (!story?.image) return;
  const thumb = story.thumbnailUrl?.trim();
  if (thumb && thumb !== story.image) prefetchStoryMediaUrl(thumb);
  prefetchStoryMediaUrl(story.image);
}

export function clearStoryPrefetchSession(): void {
  seen.clear();
  for (const el of headLinks) {
    try {
      el.remove();
    } catch {
      /* ignore */
    }
  }
  headLinks.length = 0;
}

export function scheduleIdlePrefetch(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(fn, { timeout: 1400 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 320);
  return () => window.clearTimeout(t);
}
