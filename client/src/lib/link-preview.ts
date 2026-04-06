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
    // POST — тело JSON, без гигантского query (nginx/client_max_body_size / лимиты строки запроса).
    const res = await apiFetch(`${API}/link-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LinkPreview;
    const empty = !data.image && !data.title && !data.description && !data.embedUrl;
    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    cache.set(key, empty ? null : data);
    return empty ? null : data;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
  return m ? m[0] : null;
}
