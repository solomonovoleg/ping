import { API, apiFetch } from "@/lib/api-base";
import { normalizeFeedPost, type FeedPost } from "@/lib/posts";

export type PublicProfile = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  nickname?: string | null;
  gender: string | null;
  avatarUrl: string | null;
  coverUrl?: string | null;
  showCover?: boolean;
  profileLink?: string | null;
  /** Город в профиле (по желанию) */
  city?: string | null;
  hideFromSearch: boolean;
  bio: string | null;
  canMessage: boolean;
  isInMyContacts?: boolean;
  isFollowing?: boolean;
  isMe: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reactionsCount: number;
  commentsCount: number;
  /** Подписки, пересекающиеся с просматриваемым профилем (только чужой профиль). */
  mutualFollowers?: {
    count: number;
    preview: Array<{
      id: string;
      publicId: number;
      displayName: string | null;
      surname: string | null;
      avatarUrl: string | null;
    }>;
  };
};

function normalizeProfileRouteId(id: string): string {
  const raw = id.trim();
  try {
    return decodeURIComponent(raw).trim().replace(/^@+/, "");
  } catch {
    return raw.replace(/^@+/, "");
  }
}

export async function fetchUserProfile(id: string): Promise<PublicProfile | null> {
  const profileId = normalizeProfileRouteId(id);
  const res = await apiFetch(`${API}/users/profile/${encodeURIComponent(profileId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Не удалось загрузить профиль");
  return res.json();
}

/** Профиль + посты + сториз одним запросом (цель загрузки ≤0.28 с). */
export async function fetchProfilePage(
  id: string,
  postsLimit = 50
): Promise<{ profile: PublicProfile; posts: FeedPost[]; stories: unknown[] } | null> {
  const profileId = normalizeProfileRouteId(id);
  const params = new URLSearchParams();
  if (postsLimit > 0) params.set("postsLimit", String(Math.min(postsLimit, 100)));
  const res = await apiFetch(
    `${API}/users/profile/${encodeURIComponent(profileId)}/page?${params}`,
    { credentials: "include", cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Не удалось загрузить профиль");
  let data: { profile?: unknown; posts?: unknown; stories?: unknown };
  try {
    data = await res.json();
  } catch {
    throw new Error("Не удалось загрузить профиль");
  }
  if (!data?.profile || typeof data.profile !== "object") return null;
  const rawPosts = Array.isArray(data.posts) ? data.posts : [];
  const posts: FeedPost[] = [];
  for (const item of rawPosts) {
    const normalized = normalizeFeedPost(item);
    if (normalized) posts.push(normalized);
  }
  return {
    profile: data.profile as PublicProfile,
    posts,
    stories: Array.isArray(data.stories) ? data.stories : [],
  };
}

export async function addContact(contactUserId: string): Promise<void> {
  const res = await apiFetch(`${API}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ contactUserId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "Не удалось добавить в контакты");
  }
}

export async function listContactIds(): Promise<string[]> {
  const res = await apiFetch(`${API}/contacts`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type ContactUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
};

/** Совпадение телефонной книги с аккаунтом Ping (ответ /api/contacts/match-phones). */
export type ContactPhoneMatchUser = ContactUser & { isInMyContacts: boolean };

/** Список контактов с краткими профилями для экрана «Контакты» */
export async function listContactsWithProfiles(): Promise<ContactUser[]> {
  const res = await apiFetch(`${API}/contacts?list=1`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Какие из переданных номеров (любой строковый формат) зарегистрированы в Ping. */
export async function matchContactsFromPhones(phones: string[]): Promise<ContactPhoneMatchUser[]> {
  const res = await apiFetch(`${API}/contacts/match-phones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ phones }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) ?? "Не удалось проверить контакты");
  }
  const data: unknown = await res.json();
  if (!data || typeof data !== "object" || !("matches" in data)) return [];
  const m = (data as { matches: unknown }).matches;
  if (!Array.isArray(m)) return [];
  return m as ContactPhoneMatchUser[];
}

/** Подписаться на пользователя */
export async function followUser(userId: string): Promise<void> {
  const res = await apiFetch(`${API}/users/${encodeURIComponent(userId)}/follow`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) ?? "Не удалось подписаться");
  }
}

/** Отписаться */
export async function unfollowUser(userId: string): Promise<void> {
  const res = await apiFetch(`${API}/users/${encodeURIComponent(userId)}/follow`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) ?? "Не удалось отписаться");
  }
}

export type FollowUser = ContactUser;

/** Подписчики пользователя */
export async function fetchFollowers(userId: string, limit = 50, offset = 0): Promise<FollowUser[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await apiFetch(`${API}/users/${encodeURIComponent(userId)}/followers?${params}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Подписки пользователя */
export async function fetchFollowing(userId: string, limit = 50, offset = 0): Promise<FollowUser[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await apiFetch(`${API}/users/${encodeURIComponent(userId)}/following?${params}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
