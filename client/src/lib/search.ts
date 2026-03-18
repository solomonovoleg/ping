import { API, apiFetch } from "@/lib/api-base";

export type SearchUser = {
  id: string;
  publicId: number;
  phone: string;
  displayName: string | null;
  surname: string | null;
  gender?: string | null;
  birthDate?: string | null;
  avatarUrl: string | null;
};

export async function searchUsers(q: string): Promise<SearchUser[]> {
  if (!q.trim()) return [];
  const res = await apiFetch(`${API}/users/search?q=${encodeURIComponent(q.trim())}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Ошибка поиска");
  return res.json();
}

export type Chat = {
  id: string;
  type: string;
  name: string | null;
  createdAt: string;
};

export async function startDm(userId: string): Promise<Chat> {
  const res = await apiFetch(`${API}/chats/start-dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) || "Не удалось начать диалог"
    );
  }
  return data as Chat;
}

/** Создать групповой чат: name — название, memberIds — id пользователей (кроме себя). */
export async function createGroupChat(name: string, memberIds: string[]): Promise<Chat> {
  const res = await apiFetch(`${API}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "group", name: name.trim() || null, memberIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) || "Не удалось создать группу"
    );
  }
  return data as Chat;
}

export function formatUserDisplayName(u: SearchUser): string {
  const parts = [u.displayName, u.surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : `ID ${u.publicId}`;
}
