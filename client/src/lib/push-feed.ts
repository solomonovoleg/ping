import { API, apiFetch } from "@/lib/api-base";
import type { PushTtlValue } from "@shared/schema/push-feed";

export type PushFeedItem = {
  id: string;
  postId: string;
  postLinkCode: string | null;
  postAuthorId: string;
  postAuthorPublicId: number | null;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[];
  createdAt: string;
  expiresAt: string | null;
  ttl: PushTtlValue;
  /** Уникальные зрители (зафиксированные показы карточки). */
  uniqueViewsCount: number;
  reactionsCount: number;
  repliesCount: number;
  /** Реакция текущего пользователя на карточку (с сервера; в старом кэше может отсутствовать). */
  myReaction?: string | null;
  latestReply: PushReplyItem | null;
  author: {
    id: string;
    publicId: number | null;
    displayName: string;
    avatarUrl: string | null;
    isBusiness: boolean;
    notificationsEnabled: boolean;
  };
};
export type PushReplyItem = {
  id: string;
  text: string;
  visibility: "public" | "private";
  createdAt: string | null;
  author: {
    id: string;
    publicId: number | null;
    displayName: string;
    avatarUrl: string | null;
  };
};

export type PushQuota = {
  maxPerDay: number;
  used: number;
  remaining: number;
  subscribersInFeed: number;
  notifyRecipients: number;
};
export type PushGlobalSettings = { notificationsEnabled: boolean };

export async function fetchPushFeed(limit = 30, offset = 0): Promise<PushFeedItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await apiFetch(`${API}/push/feed?${params}`, { credentials: "include", cache: "no-store" });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = body && typeof body.message === "string" ? body.message : "Не удалось загрузить Push-ленту";
    throw new Error(msg);
  }
  return Array.isArray(body) ? (body as PushFeedItem[]) : [];
}

export async function fetchPushOutbox(limit = 30, offset = 0): Promise<PushFeedItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await apiFetch(`${API}/push/outbox?${params}`, { credentials: "include", cache: "no-store" });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = body && typeof body.message === "string" ? body.message : "Не удалось загрузить исходящие Push";
    throw new Error(msg);
  }
  return Array.isArray(body) ? (body as PushFeedItem[]) : [];
}

/** Однократная фиксация просмотра карточки Push (входящая лента подписчика). */
export async function recordPushPostView(pushPostId: string): Promise<void> {
  const res = await apiFetch(`${API}/push/feed/${encodeURIComponent(pushPostId)}/view`, {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 204 || res.ok) return;
  if (res.status === 404 || res.status === 403) return;
  const body = await res.json().catch(() => ({}));
  throw new Error(typeof body?.message === "string" ? body.message : "Не удалось записать просмотр");
}

export async function fetchMyPushQuota(): Promise<PushQuota> {
  const res = await apiFetch(`${API}/push/quota`, { credentials: "include", cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && typeof body.message === "string" ? body.message : "Не удалось загрузить лимит Push";
    throw new Error(msg);
  }
  return {
    maxPerDay: Number(body?.maxPerDay ?? 3) || 3,
    used: Number(body?.used ?? 0) || 0,
    remaining: Math.max(0, Number(body?.remaining ?? 0) || 0),
    subscribersInFeed: Math.max(0, Number(body?.subscribersInFeed ?? 0) || 0),
    notifyRecipients: Math.max(0, Number(body?.notifyRecipients ?? 0) || 0),
  };
}

export async function subscribePushAuthor(authorId: string): Promise<void> {
  const res = await apiFetch(`${API}/push/subscribe/${encodeURIComponent(authorId)}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось подписаться на Push");
  }
}

export async function unsubscribePushAuthor(authorId: string): Promise<void> {
  const res = await apiFetch(`${API}/push/subscribe/${encodeURIComponent(authorId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось отписаться от Push");
  }
}

export async function fetchPushSubscriptionStatus(authorId: string): Promise<boolean> {
  const res = await apiFetch(`${API}/push/subscription-status/${encodeURIComponent(authorId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return false;
  return body?.subscribed === true;
}

export async function fetchPushSubscriptionSettings(
  authorId: string,
): Promise<{ subscribed: boolean; notificationsEnabled: boolean; hidden: boolean }> {
  const res = await apiFetch(`${API}/push/subscription-status/${encodeURIComponent(authorId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { subscribed: false, notificationsEnabled: true, hidden: false };
  return {
    subscribed: body?.subscribed === true,
    notificationsEnabled: body?.notificationsEnabled !== false,
    hidden: body?.hidden === true,
  };
}

/** Для экрана профиля: отличить выключенный модуль Push (404) от ошибки сети. */
export type PushSubscriptionProfileLoad =
  | { module: "off" }
  | { module: "on"; subscribed: boolean; notificationsEnabled: boolean; hidden: boolean }
  | { module: "error" };

export async function loadPushSubscriptionForProfilePage(authorId: string): Promise<PushSubscriptionProfileLoad> {
  const res = await apiFetch(`${API}/push/subscription-status/${encodeURIComponent(authorId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 404) return { module: "off" };
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { module: "error" };
  return {
    module: "on",
    subscribed: body?.subscribed === true,
    notificationsEnabled: body?.notificationsEnabled !== false,
    hidden: body?.hidden === true,
  };
}

export async function fetchPushGlobalSettings(): Promise<PushGlobalSettings> {
  const res = await apiFetch(`${API}/push/settings`, { credentials: "include", cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error("Не удалось загрузить настройки Push");
  return { notificationsEnabled: body?.notificationsEnabled !== false };
}

export async function updatePushGlobalSettings(notificationsEnabled: boolean): Promise<void> {
  const res = await apiFetch(`${API}/push/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ notificationsEnabled }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось сохранить настройки Push");
  }
}

export async function updatePushAuthorSettings(authorId: string, notificationsEnabled: boolean): Promise<void> {
  const res = await apiFetch(`${API}/push/subscribe/${encodeURIComponent(authorId)}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ notificationsEnabled }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body?.message === "string" ? body.message : "Не удалось обновить уведомления от этого автора",
    );
  }
}

export async function updatePushAuthorHidden(authorId: string, hidden: boolean): Promise<void> {
  const res = await apiFetch(`${API}/push/subscribe/${encodeURIComponent(authorId)}/hide`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ hidden }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось скрыть Push автора");
  }
}

export async function hidePushFeedItem(pushPostId: string): Promise<void> {
  const res = await apiFetch(`${API}/push/feed/${encodeURIComponent(pushPostId)}/hide`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось удалить Push из ленты");
  }
}

export async function setPushReaction(pushPostId: string, emoji = "❤️"): Promise<void> {
  const res = await apiFetch(`${API}/push/feed/${encodeURIComponent(pushPostId)}/reaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось поставить реакцию на Push");
  }
}

export async function removePushReaction(pushPostId: string): Promise<void> {
  const res = await apiFetch(`${API}/push/feed/${encodeURIComponent(pushPostId)}/reaction`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось убрать реакцию на Push");
  }
}

export async function createPushReply(
  pushPostId: string,
  text: string,
  visibility: "public" | "private",
): Promise<void> {
  const res = await apiFetch(`${API}/push/feed/${encodeURIComponent(pushPostId)}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text, visibility }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : "Не удалось ответить на Push");
  }
}

export type PushRepliesPageResponse = {
  items: PushReplyItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchPushReplies(
  pushPostId: string,
  opts: { limit?: number; offset?: number; visibilityFilter?: "all" | "public" } = {},
): Promise<PushRepliesPageResponse> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (opts.visibilityFilter === "public") params.set("visibility", "public");
  const res = await apiFetch(`${API}/push/feed/${encodeURIComponent(pushPostId)}/replies?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && typeof body.message === "string" ? body.message : "Не удалось загрузить ответы на Push";
    throw new Error(msg);
  }
  if (body && typeof body === "object" && Array.isArray((body as PushRepliesPageResponse).items)) {
    return body as PushRepliesPageResponse;
  }
  return { items: [], total: 0, limit, offset };
}
