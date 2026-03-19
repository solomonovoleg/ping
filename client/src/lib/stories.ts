import { API, apiFetch } from "@/lib/api-base";

export type StoryItem = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  expiresAt: string;
  viewsCount?: number;
  isViewed?: boolean;
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

export type StoryExpiresHours = 24 | 46 | 56;

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
