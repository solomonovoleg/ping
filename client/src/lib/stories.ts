import { API, apiFetch, messageForFetchFailure, postFormDataWithUploadProgress } from "@/lib/api-base";
import type { PostVideoTrimUpload } from "@/lib/posts";

/** Автор сторис (диплинк / GET по id). */
export type StoryAuthorPreview = {
  id: string;
  publicId: number;
  displayName: string | null;
  avatarUrl: string | null;
};

export type StoryItem = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
  viewsCount?: number;
  likesCount?: number;
  isViewed?: boolean;
  isLiked?: boolean;
  author?: StoryAuthorPreview;
};

export type StoryViewerUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
  viewedAt: string;
};

export async function fetchStoriesByUser(userId: string): Promise<StoryItem[]> {
  const res = await apiFetch(`${API}/users/${encodeURIComponent(userId)}/stories`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchStoriesArchive(): Promise<StoryItem[]> {
  const res = await apiFetch(`${API}/stories/archive`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Одна активная сторис по id (доступ как в ленте); для диплинков и догрузки. */
export async function fetchStoryById(storyId: string): Promise<StoryItem> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      data && typeof data.message === "string" && data.message.trim() ? data.message.trim() : `Код ${res.status}`;
    throw new Error(msg);
  }
  if (!data || typeof data.id !== "string") {
    throw new Error("Неверный ответ сервера");
  }
  const authorRaw = data.author;
  let author: StoryAuthorPreview | undefined;
  if (authorRaw && typeof authorRaw === "object") {
    const a = authorRaw as Record<string, unknown>;
    if (typeof a.id === "string" && typeof a.publicId === "number") {
      author = {
        id: a.id,
        publicId: a.publicId,
        displayName: typeof a.displayName === "string" ? a.displayName : a.displayName === null ? null : null,
        avatarUrl: typeof a.avatarUrl === "string" ? a.avatarUrl : a.avatarUrl === null ? null : null,
      };
    }
  }
  return {
    id: data.id,
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    mediaUrl: typeof data.mediaUrl === "string" ? data.mediaUrl : "",
    thumbnailUrl: data.thumbnailUrl != null ? String(data.thumbnailUrl) : null,
    caption: typeof data.caption === "string" ? data.caption : data.caption === null ? null : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : "",
    viewsCount: typeof data.viewsCount === "number" ? data.viewsCount : undefined,
    likesCount: typeof data.likesCount === "number" ? data.likesCount : undefined,
    isViewed: typeof data.isViewed === "boolean" ? data.isViewed : undefined,
    isLiked: typeof data.isLiked === "boolean" ? data.isLiked : undefined,
    ...(author ? { author } : {}),
  };
}

export type StoryExpiresHours = 24 | 46 | 56;

export async function uploadStoryMedia(
  file: File,
  trim?: PostVideoTrimUpload,
  options?: { onProgress?: (percent: number) => void },
): Promise<string> {
  const form = new FormData();
  if (trim) {
    form.append("trimStartSec", String(trim.trimStartSec));
    form.append("trimDurationSec", String(trim.trimDurationSec));
  }
  form.append("file", file);
  let text: string;
  let status: number;
  try {
    const res = await postFormDataWithUploadProgress(`${API}/upload/story-media`, form, {
      onProgress: options?.onProgress,
    });
    text = res.bodyText;
    status = res.status;
  } catch (e) {
    throw new Error(messageForFetchFailure(e));
  }
  let data: { message?: unknown; url?: unknown } = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { message?: unknown; url?: unknown };
    } catch {
      /* non-JSON body */
    }
  }
  if (status < 200 || status >= 300) {
    if (status === 413) throw new Error("Файл слишком большой");
    const msg = typeof data.message === "string" ? data.message : null;
    throw new Error(msg || `Не удалось загрузить сториз (${status})`);
  }
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url) throw new Error("Сервер не вернул URL сториз");
  return url;
}

const STORY_CAPTION_MAX_LEN = 500;

export async function createStory(
  mediaUrl: string,
  options?: { thumbnailUrl?: string; expiresInHours?: StoryExpiresHours; caption?: string | null }
): Promise<StoryItem> {
  const cap =
    typeof options?.caption === "string" ? options.caption.trim().slice(0, STORY_CAPTION_MAX_LEN) : "";
  const res = await apiFetch(`${API}/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaUrl,
      thumbnailUrl: options?.thumbnailUrl ?? null,
      expiresInHours: options?.expiresInHours ?? 24,
      ...(cap ? { caption: cap } : {}),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ?? "Не удалось создать сториз"
    );
  }
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") {
    throw new Error("Неверный ответ сервера при создании сториз");
  }
  return {
    id: String(data.id ?? ""),
    authorId: String(data.authorId ?? ""),
    mediaUrl: String(data.mediaUrl ?? mediaUrl),
    thumbnailUrl: data.thumbnailUrl != null ? String(data.thumbnailUrl) : null,
    caption: typeof (data as { caption?: unknown }).caption === "string" ? (data as { caption: string }).caption : null,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    expiresAt: String(data.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  };
}

export async function deleteStory(storyId: string): Promise<void> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ?? "Не удалось удалить сториз"
    );
  }
}

export async function archiveStory(storyId: string): Promise<void> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}/archive`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ?? "Не удалось архивировать сториз"
    );
  }
}

/** Лента сториз: все доступные авторы (с учётом приватности/блокировок) */
export type StoriesFeedAuthor = {
  authorId: string;
  author: { id: string; publicId: number; displayName: string | null; avatarUrl: string | null };
  latestStoryAt?: string | null;
  hasUnseen?: boolean;
  unseenCount?: number;
  stories: StoryItem[];
};

export type StoriesFeedPage = {
  authors: StoriesFeedAuthor[];
  nextOffset: number;
  hasMore: boolean;
};

const STORIES_FEED_DEFAULT_LIMIT = 18;

/** Пачка ленты сториз (пагинация по авторам). При ошибке API — throw (чтобы React Query показал isError и «Повторить»). */
export async function fetchStoriesFeedPage(params?: { limit?: number; offset?: number }): Promise<StoriesFeedPage> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  const res = await apiFetch(`${API}/stories/feed${q ? `?${q}` : ""}`, { cache: "no-store" });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      raw && typeof raw === "object" && typeof (raw as { message?: unknown }).message === "string"
        ? String((raw as { message: string }).message).trim()
        : "";
    throw new Error(msg || `Лента сторис: код ${res.status}`);
  }
  const data: unknown = raw;
  if (data && typeof data === "object" && Array.isArray((data as StoriesFeedPage).authors)) {
    return data as StoriesFeedPage;
  }
  if (Array.isArray(data)) {
    return { authors: data as StoriesFeedAuthor[], nextOffset: data.length, hasMore: false };
  }
  throw new Error("Неверный ответ сервера (сторис)");
}

/** Первая страница ленты (удобно для простых экранов). */
export async function fetchStoriesFeed(): Promise<StoriesFeedAuthor[]> {
  const page = await fetchStoriesFeedPage({ limit: STORIES_FEED_DEFAULT_LIMIT, offset: 0 });
  return page.authors;
}

/** Записать просмотр сториз (идемпотентно) */
export async function recordStoryView(storyId: string): Promise<void> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}/view`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data && typeof data.message === "string" ? data.message : "Не удалось записать просмотр";
    throw new Error(msg);
  }
}

/**
 * Запись просмотра без шума в UI: 410 (истекла) и 404 — ожидаемо при лаге клиента;
 * остальные ошибки не бросаем наружу (только dev-log).
 */
export async function recordStoryViewQuiet(storyId: string): Promise<void> {
  try {
    await recordStoryView(storyId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("истёк") || msg.includes("истек") || msg.includes("не найден")) return;
    if (import.meta.env.DEV) console.warn("[stories] recordStoryView:", msg);
  }
}

/** Список пользователей, которые посмотрели мой сториз */
export async function fetchStoryViewers(storyId: string): Promise<StoryViewerUser[]> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}/viewers`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
        ? String((data as { message: string }).message).trim()
        : "";
    throw new Error(msg || `Просмотры сторис: код ${res.status}`);
  }
  return Array.isArray(data) ? data : [];
}

export async function likeStory(storyId: string): Promise<{ likesCount: number; isLiked: boolean }> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}/likes`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data && typeof data.message === "string" ? data.message : "Не удалось поставить лайк";
    throw new Error(msg);
  }
  const data = (await res.json().catch(() => ({}))) as { likesCount?: number; isLiked?: boolean };
  return { likesCount: Number(data.likesCount ?? 0), isLiked: true };
}

export async function unlikeStory(storyId: string): Promise<{ likesCount: number; isLiked: boolean }> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}/likes`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data && typeof data.message === "string" ? data.message : "Не удалось убрать лайк";
    throw new Error(msg);
  }
  const data = (await res.json().catch(() => ({}))) as { likesCount?: number; isLiked?: boolean };
  return { likesCount: Number(data.likesCount ?? 0), isLiked: false };
}
