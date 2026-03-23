/**
 * Превью ссылок: og:image, og:title, og:description.
 */
import { API, apiFetch } from "./api-base";

export type LinkPreview = {
  image: string | null;
  title: string | null;
  description: string | null;
  embedUrl?: string | null;
};

const cache = new Map<string, LinkPreview | null>();
const MAX_CACHE = 100;

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const key = url;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  try {
    const res = await apiFetch(`${API}/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as LinkPreview;
    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    cache.set(key, data);
    return data;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
  return m ? m[0] : null;
}
