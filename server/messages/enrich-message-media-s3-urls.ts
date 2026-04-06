import type { ChatMessagePayload } from "../realtime/chat";
import { presignOwnS3ObjectUrl, shouldPresignS3MediaGetUrls } from "../upload/s3-presign-media-urls";
import { deriveVideoNotePosterUrl } from "./video-note-poster";

const MEDIA_CONTENT_TYPES = new Set(["voice", "video_note", "image", "video", "file", "sticker"]);

/** Кэш presign на время одного HTTP-запроса списка сообщений (одинаковый URL → один вызов S3). */
export type PresignUrlCache = Map<string, Promise<string | null>>;

export function createPresignUrlCache(): PresignUrlCache {
  return new Map();
}

function presignOne(url: string, cache?: PresignUrlCache): Promise<string | null> {
  const k = url.trim();
  if (!cache) return presignOwnS3ObjectUrl(k);
  let p = cache.get(k);
  if (!p) {
    p = presignOwnS3ObjectUrl(k);
    cache.set(k, p);
  }
  return p;
}

async function maybePresignStickerJsonContent(content: string, cache?: PresignUrlCache): Promise<string> {
  const t = content.trim();
  if (!shouldPresignS3MediaGetUrls()) return t;
  if (!t.startsWith("{")) return t;
  try {
    const o = JSON.parse(t) as { imageUrl?: unknown };
    if (typeof o.imageUrl !== "string" || !o.imageUrl.trim()) return t;
    const raw = o.imageUrl.trim();
    if (!/^https?:\/\//i.test(raw)) return t;
    const signed = await presignOne(raw, cache);
    if (!signed || signed === raw) return t;
    return JSON.stringify({ ...o, imageUrl: signed });
  } catch {
    return t;
  }
}

async function maybePresignHttpContent(type: string, content: string, cache?: PresignUrlCache): Promise<string> {
  const t = content.trim();
  if (type === "sticker") {
    return maybePresignStickerJsonContent(t, cache);
  }
  if (!shouldPresignS3MediaGetUrls()) return t;
  if (!MEDIA_CONTENT_TYPES.has(type)) return t;
  if (!/^https?:\/\//i.test(t)) return t;
  const signed = await presignOne(t, cache);
  return signed ?? t;
}

async function presignAbsoluteUrl(u: string | null | undefined, cache?: PresignUrlCache): Promise<string | undefined> {
  if (!u?.trim()) return u ?? undefined;
  const s = u.trim();
  if (!shouldPresignS3MediaGetUrls()) return s;
  if (!/^https?:\/\//i.test(s)) return s;
  const signed = await presignOne(s, cache);
  return signed ?? s;
}

/** Сообщение из БД / списка: подписать content и poster для video_note. */
export async function enrichListMessageOwnS3Urls<T extends { type: string; content: unknown; videoPosterUrl?: string | null }>(
  m: T,
  urlCache?: PresignUrlCache,
): Promise<T> {
  if (typeof m.content !== "string") return m;
  const content = await maybePresignHttpContent(m.type, m.content, urlCache);
  if (m.type !== "video_note") {
    if (content === m.content) return m;
    return { ...m, content } as T;
  }
  const posterRaw = deriveVideoNotePosterUrl(content) ?? null;
  const videoPosterUrl = posterRaw ? await presignAbsoluteUrl(posterRaw, urlCache) : undefined;
  if (content === m.content && videoPosterUrl === m.videoPosterUrl) return m;
  return { ...m, content, videoPosterUrl } as T;
}

/** WebSocket / API Hub: тот же контракт, что у ChatMessagePayload. */
export async function enrichChatMessagePayloadOwnS3Urls(payload: ChatMessagePayload): Promise<ChatMessagePayload> {
  const content = await maybePresignHttpContent(payload.type, payload.content);
  if (payload.type !== "video_note") {
    if (content === payload.content) return payload;
    return { ...payload, content };
  }
  const posterRaw = deriveVideoNotePosterUrl(content) ?? null;
  const videoPosterUrl = posterRaw ? await presignAbsoluteUrl(posterRaw) : undefined;
  if (content === payload.content && videoPosterUrl === payload.videoPosterUrl) return payload;
  return { ...payload, content, videoPosterUrl };
}
