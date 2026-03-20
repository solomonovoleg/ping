import { API, apiFetch } from "@/lib/api-base";

export type StoryItem = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  expiresAt: string;
  viewsCount?: number;
  likesCount?: number;
  isViewed?: boolean;
  isLiked?: boolean;
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

export type StoryExpiresHours = 24 | 46 | 56;

export async function uploadStoryMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`${API}/upload/story-media`, {
    method: "POST",
    body: form,
  });
  const text = await res.text();
  let data: { message?: unknown; url?: unknown } = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { message?: unknown; url?: unknown };
    } catch {
      /* non-JSON body */
    }
  }
  if (!res.ok) {
    if (res.status === 413) throw new Error("Файл слишком большой");
    const msg = typeof data.message === "string" ? data.message : null;
    throw new Error(msg || `Не удалось загрузить сториз (${res.status})`);
  }
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url) throw new Error("Сервер не вернул URL сториз");
  return url;
}

export async function createStory(
  mediaUrl: string,
  options?: { thumbnailUrl?: string; expiresInHours?: StoryExpiresHours }
): Promise<StoryItem> {
  const res = await apiFetch(`${API}/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaUrl,
      thumbnailUrl: options?.thumbnailUrl ?? null,
      expiresInHours: options?.expiresInHours ?? 24,
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
  activityScore?: number;
  stories: StoryItem[];
};

export async function fetchStoriesFeed(): Promise<StoriesFeedAuthor[]> {
  const res = await apiFetch(`${API}/stories/feed`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
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

/** Список пользователей, которые посмотрели мой сториз */
export async function fetchStoryViewers(storyId: string): Promise<StoryViewerUser[]> {
  const res = await apiFetch(`${API}/stories/${encodeURIComponent(storyId)}/viewers`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
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
