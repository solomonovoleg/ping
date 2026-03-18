import { API, apiFetch } from "@/lib/api-base";

export type StoryItem = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

export async function fetchStoriesByUser(userId: string): Promise<StoryItem[]> {
  const res = await apiFetch(`${API}/users/${encodeURIComponent(userId)}/stories`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createStory(mediaUrl: string, thumbnailUrl?: string): Promise<StoryItem> {
  const res = await apiFetch(`${API}/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaUrl, thumbnailUrl: thumbnailUrl ?? null }),
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

/** Лента сторис: авторы (я + подписки) с хотя бы одним сториз за 24ч */
export type StoriesFeedAuthor = {
  authorId: string;
  author: { id: string; publicId: number; displayName: string | null; avatarUrl: string | null };
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
