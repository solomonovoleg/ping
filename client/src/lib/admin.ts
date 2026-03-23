import { API, apiFetch } from "@/lib/api-base";

function adminFetch(path: string, init?: RequestInit) {
  return apiFetch(`${API}${path}`, { ...init, credentials: "include" });
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

export type AdminMetricPoint = {
  at: string;
  onlineUsers: number;
  openConnections: number;
  heapUsedMb: number;
  rssMb: number;
  load1m: number;
};

export type DashboardAnalytics = {
  registrationsByDay: { day: string; count: number }[];
  serverMetrics: {
    current: AdminMetricPoint;
    history: AdminMetricPoint[];
  };
  metricsNote?: string;
};

export async function fetchDashboardAnalytics(days = 14): Promise<DashboardAnalytics> {
  const safe = Math.min(90, Math.max(1, Math.floor(days)));
  const res = await adminFetch(`/admin/dashboard/analytics?days=${safe}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type AdminUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  isBlocked?: boolean;
  deletedAt?: string | null;
  createdAt?: string | null;
  platformRole?: string;
  /** Количество приглашённых пользователей */
  referralCount?: number;
  /** Лимит приглашений (null = 3 по умолчанию). Админ может увеличить. */
  referralLimit?: number | null;
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
  payload: Partial<Pick<AdminUser, "displayName" | "surname" | "referralLimit">> & { status?: string; city?: string; bio?: string }
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

export type FeedAlgoMode = "strict_chrono" | "chrono_boost_v1";
export type FeedAlgoConfig = {
  mode: FeedAlgoMode;
  boostWindowHours: number;
  boostCapMinutes: number;
  reactionBoostMinutes: number;
  commentBoostMinutes: number;
  shareBoostMinutes: number;
  candidatePadding: number;
  candidateMin: number;
  candidateMax: number;
  veryNewAccountHours: number;
  newAccountHours: number;
  veryNewAccountFactor: number;
  newAccountFactor: number;
};

export async function fetchFeedAlgorithm(): Promise<FeedAlgoConfig> {
  const res = await adminFetch("/admin/feed-algorithm");
  if (!res.ok) throw new Error("Ошибка загрузки алгоритма ленты");
  return res.json();
}

export async function updateFeedAlgorithm(patch: Partial<FeedAlgoConfig>): Promise<FeedAlgoConfig> {
  const res = await adminFetch("/admin/feed-algorithm", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка обновления алгоритма ленты");
  }
  return res.json();
}

export type AdminParserUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  phone: string;
};

export type ContentIngestConfig = {
  enabled: boolean;
  sourceName: string;
  sourceUrl: string;
  authorUserId: string | null;
  intervalMinutes: number;
  postsPerRun: number;
  includeImage: boolean;
  onlyWithImage: boolean;
};

export type ContentIngestStatus = {
  isRunning: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastCreated: number;
  lastSkipped: number;
};

export type ContentIngestState = {
  config: ContentIngestConfig;
  status: ContentIngestStatus;
};

export async function fetchContentIngestState(): Promise<ContentIngestState> {
  const res = await adminFetch("/admin/content-ingest");
  if (!res.ok) throw new Error("Ошибка загрузки настроек парсера");
  return res.json();
}

export async function updateContentIngestConfig(patch: Partial<ContentIngestConfig>): Promise<ContentIngestState> {
  const res = await adminFetch("/admin/content-ingest", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка сохранения настроек парсера");
  }
  return res.json();
}

export async function runContentIngestNow(): Promise<{
  created: number;
  skipped: number;
  totalItems: number;
  message: string;
  state: ContentIngestState;
}> {
  const res = await adminFetch("/admin/content-ingest/run", {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка запуска парсера");
  }
  return res.json();
}

export async function fetchParserUsers(search?: string): Promise<AdminParserUser[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  params.set("limit", "80");
  const res = await adminFetch(`/admin/content-ingest/users?${params.toString()}`);
  if (!res.ok) throw new Error("Ошибка загрузки пользователей для автопостинга");
  const data = await res.json().catch(() => ({ users: [] }));
  return data.users ?? [];
}

/** Парсер ВК → посты от имени пользователя платформы */
export type AdminVkParserBinding = {
  id: string;
  platformUserId: string;
  displayName: string | null;
  vkOwnerId: string;
  tokenConfigured: boolean;
  enabled: boolean;
  parseIntervalMinutes: number;
  postsPerRun: number;
  requireModeration: boolean;
  visibility: string;
  cityLine: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  lastCreatedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminVkParserItem = {
  id: string;
  bindingId: string;
  vkPostKey: string;
  status: string;
  postText: string;
  mediaUrls: string[] | null;
  mediaLayout: unknown;
  platformPostId: string | null;
  vkPostDate: number | null;
  errorMessage: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export async function fetchVkParserBindings(): Promise<AdminVkParserBinding[]> {
  const res = await adminFetch("/admin/vk-parser/bindings");
  if (!res.ok) throw new Error("Не удалось загрузить привязки ВК");
  const data = await res.json();
  return data.bindings ?? [];
}

export async function createVkParserBinding(body: {
  platformUserId: string;
  vkAccessToken: string;
  vkOwnerId: string;
  displayName?: string | null;
  parseIntervalMinutes?: number;
  postsPerRun?: number;
  requireModeration?: boolean;
  visibility?: "public" | "followers";
  cityLine?: string | null;
  enabled?: boolean;
}): Promise<AdminVkParserBinding> {
  const res = await adminFetch("/admin/vk-parser/bindings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || "Ошибка создания привязки");
  return (data as { binding: AdminVkParserBinding }).binding;
}

export async function updateVkParserBinding(
  id: string,
  patch: Partial<{
    displayName: string | null;
    vkAccessToken: string;
    vkOwnerId: string;
    parseIntervalMinutes: number;
    postsPerRun: number;
    requireModeration: boolean;
    visibility: "public" | "followers";
    cityLine: string | null;
    enabled: boolean;
  }>,
): Promise<AdminVkParserBinding> {
  const res = await adminFetch(`/admin/vk-parser/bindings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || "Ошибка сохранения");
  return (data as { binding: AdminVkParserBinding }).binding;
}

export async function deleteVkParserBinding(id: string): Promise<void> {
  const res = await adminFetch(`/admin/vk-parser/bindings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Ошибка удаления");
  }
}

export async function runVkParserBindingNow(
  id: string,
): Promise<{ created: number; skipped: number; duplicates: number }> {
  const res = await adminFetch(`/admin/vk-parser/bindings/${encodeURIComponent(id)}/run`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || "Ошибка запуска");
  return data as { created: number; skipped: number; duplicates: number };
}

export async function runVkParserAllEnabled(): Promise<{
  results: (
    | { bindingId: string; ok: true; created: number; skipped: number; duplicates: number }
    | { bindingId: string; ok: false; error: string }
  )[];
}> {
  const res = await adminFetch("/admin/vk-parser/run-all", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || "Ошибка");
  return data as {
    results: (
      | { bindingId: string; ok: true; created: number; skipped: number; duplicates: number }
      | { bindingId: string; ok: false; error: string }
    )[];
  };
}

export async function fetchVkParserItems(opts?: {
  bindingId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminVkParserItem[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.bindingId) params.set("bindingId", opts.bindingId);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const res = await adminFetch(`/admin/vk-parser/items?${params.toString()}`);
  if (!res.ok) throw new Error("Не удалось загрузить очередь");
  const data = await res.json();
  return {
    items: data.items ?? [],
    total: typeof data.total === "number" ? data.total : 0,
  };
}

export async function approveVkParserItem(itemId: string): Promise<{ platformPostId: string }> {
  const res = await adminFetch(`/admin/vk-parser/items/${encodeURIComponent(itemId)}/approve`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || "Ошибка публикации");
  return data as { platformPostId: string };
}

export async function rejectVkParserItem(itemId: string): Promise<void> {
  const res = await adminFetch(`/admin/vk-parser/items/${encodeURIComponent(itemId)}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Ошибка");
  }
}

export async function testVkParserToken(token: string): Promise<{ vkUserId: number }> {
  const res = await adminFetch("/admin/vk-parser/test-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || "Токен не прошёл проверку");
  return data as { vkUserId: number };
}

export type FetchAuditLogOpts = {
  limit?: number;
  offset?: number;
  action?: string;
  adminId?: string;
  targetType?: string;
  since?: string;
  until?: string;
};

export async function fetchAuditLog(opts?: FetchAuditLogOpts): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  const o = opts ?? {};
  if (o.limit != null) params.set("limit", String(o.limit));
  if (o.offset != null) params.set("offset", String(o.offset));
  if (o.action?.trim()) params.set("action", o.action.trim());
  if (o.adminId?.trim()) params.set("adminId", o.adminId.trim());
  if (o.targetType?.trim()) params.set("targetType", o.targetType.trim());
  if (o.since?.trim()) params.set("since", o.since.trim());
  if (o.until?.trim()) params.set("until", o.until.trim());
  const res = await adminFetch(`/admin/audit-log?${params}`);
  if (!res.ok) return [];
  return res.json();
}

/** CSV только для admin / super_admin (403 у модератора) */
export async function downloadAdminAuditCsv(): Promise<void> {
  const res = await adminFetch("/admin/audit-log?format=csv");
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || "Ошибка экспорта");
    }
    throw new Error((await res.text()) || "Ошибка экспорта");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export type AdminReferralCode = {
  id: string;
  code: string;
  expiresAt: string;
  expiresInHours?: number;
  maxUses?: number;
  useCount?: number;
};

export async function createAdminReferralCode(opts?: {
  format?: "phrase" | "digits";
  expiresInHours?: number;
  /** Без лимита использований до даты истечения */
  multiUse?: boolean;
  /** Фиксированное число регистраций (если не multiUse) */
  maxUses?: number;
}): Promise<AdminReferralCode> {
  const res = await adminFetch("/admin/referrals/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка создания кода");
  }
  return res.json();
}

export async function fetchAdminReferralCodes(): Promise<AdminReferralCode[]> {
  const res = await adminFetch("/admin/referrals/codes");
  if (!res.ok) throw new Error("Ошибка загрузки кодов");
  const data = await res.json();
  return data.codes ?? [];
}

export type ServiceChatHostState = {
  hostUserId: string;
  enabled: boolean;
  globalRepliesAllowed: boolean;
  activatedAt: string | null;
  displayName: string | null;
  surname: string | null;
  publicId: number;
};

export type ServiceChatTemplateStep = {
  id: string;
  orderIndex: number;
  content: string;
  mediaJson?: string | null;
  delayAfterReadSec: number;
};

export type ServiceChatTemplate = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  steps: ServiceChatTemplateStep[];
};

export async function fetchServiceChatState(): Promise<{ hosts: ServiceChatHostState[] }> {
  const res = await adminFetch("/service-chat/admin/state");
  if (!res.ok) throw new Error("Не удалось загрузить service-chat");
  return res.json();
}

export async function updateServiceChatHostConfig(payload: {
  hostUserId: string;
  enabled: boolean;
  globalRepliesAllowed: boolean;
}): Promise<void> {
  const res = await adminFetch("/service-chat/admin/host", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось сохранить хоста");
  }
}

export async function fetchServiceChatTemplates(hostUserId: string): Promise<{ templates: ServiceChatTemplate[] }> {
  const res = await adminFetch(`/service-chat/admin/templates/${encodeURIComponent(hostUserId)}`);
  if (!res.ok) throw new Error("Не удалось загрузить шаблоны");
  return res.json();
}

export async function replaceServiceChatTemplate(payload: {
  hostUserId: string;
  name: string;
  steps: Array<{ content: string; delayAfterReadSec: number; mediaJson?: string | null }>;
}): Promise<void> {
  const res = await adminFetch(`/service-chat/admin/templates/${encodeURIComponent(payload.hostUserId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: payload.name, steps: payload.steps }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось сохранить шаблон");
  }
}

export async function runServiceChatCampaign(payload: {
  hostUserId: string;
  mode: "all" | "selected" | "personal";
  targetUserIds?: string[];
  content?: string;
  mediaJson?: string | null;
}): Promise<{ campaignId: string; targetCount: number; affectedThreads: number; sentMessagesTo: number }> {
  const res = await adminFetch("/service-chat/admin/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось запустить рассылку");
  }
  return res.json();
}
