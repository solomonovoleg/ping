import { API } from "@/lib/api-base";

export type AdminStats = {
  total: number;
  blocked: number;
  deleted: number;
  registeredToday: number;
};

export type AdminUser = {
  id: string;
  publicId: number;
  phone: string;
  displayName: string | null;
  surname: string | null;
  gender: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  isBlocked: boolean;
  deletedAt: string | null;
  createdAt: string;
};

export async function adminMe(): Promise<boolean> {
  const res = await fetch(`${API}/admin/me`, { credentials: "include" });
  return res.ok;
}

export async function adminLogin(login: string, password: string): Promise<void> {
  const res = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка входа");
  }
}

export async function adminLogout(): Promise<void> {
  await fetch(`${API}/admin/logout`, { method: "POST", credentials: "include" });
}

export async function adminGetStats(): Promise<AdminStats> {
  const res = await fetch(`${API}/admin/dashboard/stats`, { credentials: "include" });
  if (!res.ok) throw new Error("Ошибка загрузки статистики");
  return res.json();
}

export async function adminGetUsers(opts: {
  limit?: number;
  offset?: number;
  deleted?: boolean;
  search?: string;
}): Promise<{ users: AdminUser[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.deleted) params.set("includeDeleted", "true");
  if (opts.search) params.set("search", opts.search);
  const res = await fetch(`${API}/admin/users?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Ошибка загрузки пользователей");
  return res.json();
}

export async function adminBlockUser(id: string): Promise<void> {
  const res = await fetch(`${API}/admin/users/${encodeURIComponent(id)}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка блокировки");
  }
}

export async function adminUnblockUser(id: string): Promise<void> {
  const res = await fetch(`${API}/admin/users/${encodeURIComponent(id)}/unban`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка разблокировки");
  }
}

export async function adminDeleteUser(id: string): Promise<void> {
  const res = await fetch(`${API}/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка удаления");
  }
}
