import { API } from "@/lib/api-base";

function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, { credentials: "include", ...init });
}

export type DashboardStats = {
  total: number;
  blocked: number;
  deleted: number;
  registeredToday: number;
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await adminFetch("/admin/dashboard/stats");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type AdminUser = {
  id: string;
  publicId: number;
  phone: string;
  displayName: string | null;
  surname: string | null;
  isBlocked?: boolean;
  deletedAt?: string | null;
  createdAt?: string | null;
  platformRole?: string;
  /** Количество приглашённых пользователей */
  referralCount?: number;
};

export async function fetchAdminUsers(opts: {
  limit?: number;
  offset?: number;
  search?: string;
  includeDeleted?: boolean;
}): Promise<{ users: AdminUser[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.search) params.set("search", opts.search);
  if (opts.includeDeleted) params.set("includeDeleted", "true");
  const res = await adminFetch(`/admin/users?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminUser(id: string): Promise<AdminUser | null> {
  const res = await adminFetch(`/admin/users/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAdminUser(
  id: string,
  payload: Partial<Pick<AdminUser, "displayName" | "surname">> & { status?: string; city?: string; bio?: string }
): Promise<AdminUser> {
  const res = await adminFetch(`/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка сохранения профиля");
  }
  return res.json();
}

export async function banUser(id: string, reason?: string): Promise<void> {
  const res = await adminFetch(`/admin/users/${id}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason ?? "" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка блокировки");
  }
}

export async function unbanUser(id: string): Promise<void> {
  const res = await adminFetch(`/admin/users/${id}/unban`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка разблокировки");
  }
}

export async function deleteUser(id: string): Promise<void> {
  const res = await adminFetch(`/admin/users/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка удаления");
  }
}

export type AdminEntry = {
  id: string;
  publicId: number;
  phone: string;
  displayName: string | null;
  surname: string | null;
  platformRole: string;
};

export async function fetchAdmins(): Promise<AdminEntry[]> {
  const res = await adminFetch("/admin/admins");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setAdminRole(userId: string, role: string): Promise<void> {
  const res = await adminFetch(`/admin/admins/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка смены роли");
  }
}

export type AuditLogEntry = {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export async function fetchAuditLog(opts: { limit?: number; offset?: number }): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  const res = await adminFetch(`/admin/audit-log?${params}`);
  if (!res.ok) return [];
  return res.json();
}
