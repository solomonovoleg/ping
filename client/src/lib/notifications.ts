import { API, apiFetch } from "@/lib/api-base";

export type NotificationItem = {
  id: string;
  type: string;
  actorId: string;
  actorPublicId: number | null;
  actorName: string;
  actorAvatarUrl: string | null;
  postId: string | null;
  postAuthorId: string | null;
  postAuthorPublicId: number | null;
  commentId: string | null;
  excerpt: string | null;
  readAt: string | null;
  createdAt: string | null;
};

export async function fetchNotifications(limit = 50, offset = 0): Promise<NotificationItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await apiFetch(`${API}/notifications?${params}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await apiFetch(`${API}/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data && typeof data.message === "string" ? data.message : "Не удалось отметить прочитанным";
    throw new Error(msg);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await apiFetch(`${API}/notifications/read-all`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data && typeof data.message === "string" ? data.message : "Не удалось отметить все прочитанными";
    throw new Error(msg);
  }
}
