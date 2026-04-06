import { API, apiFetch, toApiRequestError } from "@/lib/api-base";

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
  if (!res.ok) throw await toApiRequestError(res);
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
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}

export type NewTelCallPasswordLogSummary = {
  totalRequests: number;
  startPasswordCalls: number;
  statusPolls: number;
  apiErrors: number;
};

export type NewTelCallPasswordLogDayBucket = {
  day: string;
  totalRequests: number;
  startPasswordCalls: number;
  statusPolls: number;
  apiErrors: number;
};

export type NewTelCallPasswordLogRow = {
  id: string;
  createdAt: string;
  scenario: string;
  apiMethod: string;
  durationMs: number;
  httpStatus: number | null;
  apiOk: boolean | null;
  errorMessage: string | null;
  requestRedacted: unknown;
  responseSanitized: unknown;
  /** Полный разбор: URL, слои ответа New-Tel, внутренние коды подтверждения */
  detail: unknown;
};

export type NewTelCallPasswordLogResponse = {
  days: number;
  from: string;
  summary: NewTelCallPasswordLogSummary;
  byDay: NewTelCallPasswordLogDayBucket[];
  rows: NewTelCallPasswordLogRow[];
  truncated: boolean;
  rowLimit: number;
};

export async function fetchNewTelCallPasswordLog(days = 14): Promise<NewTelCallPasswordLogResponse> {
  const safe = Math.min(90, Math.max(1, Math.floor(days)));
  const res = await adminFetch(`/admin/new-tel-call-password-log?days=${safe}`);
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}

/** Эвристика для списка пользователей (сервер). */
export type AdminSignupRisk = {
  level: "none" | "watch" | "alert";
  reasons: string[];
  sameDeviceOthers: number;
  sameIpUaOthers: number;
};

export type AdminUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  isBlocked?: boolean;
  deletedAt?: string | null;
  createdAt?: string | null;
  platformRole?: string;
  invitedById?: string | null;
  /** Сигнал «обратить внимание» в списке */
  signupRisk?: AdminSignupRisk;
  /** Сырые поля регистрации (в карточке деталей / GET user) */
  signupIp?: string | null;
  signupForwardedFor?: string | null;
  signupUserAgent?: string | null;
  signupUaHash?: string | null;
  signupAcceptLanguage?: string | null;
  signupSecChUa?: string | null;
  signupSecChUaMobile?: string | null;
  signupSecChUaPlatform?: string | null;
  signupReferer?: string | null;
  signupOrigin?: string | null;
  signupDeviceId?: string | null;
  signupClientSignalsHash?: string | null;
  signupClientSignalsJson?: string | null;
  /** Кто пригласил (если регистрация по рефералу) */
  invitedByUser?: {
    publicId: number;
    displayName: string | null;
    surname: string | null;
  } | null;
  /** Количество приглашённых пользователей */
  referralCount?: number;
  /** Лимит приглашений (null = 3 по умолчанию). Админ может увеличить. */
  referralLimit?: number | null;
  /** PRIME CODE: непустая строка — доступ к API HUB на Борде; пусто/null — отозвать */
  boardApiHubPrimeCode?: string | null;
  businessStatus?: "none" | "pending" | "approved" | "rejected" | "revision_required";
};

export type AdminBusinessStatusRequest = {
  id: string;
  userId: string;
  reason: string;
  links: string[];
  consentModeration: boolean;
  status: "submitted" | "approved" | "rejected" | "revision_required";
  adminComment: string | null;
  moderatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  moderatedAt: string | null;
  user: {
    id: string;
    publicId: number;
    displayName: string | null;
    surname: string | null;
    avatarUrl: string | null;
    businessStatus: "none" | "pending" | "approved" | "rejected" | "revision_required";
  };
};

export async function fetchAdminUsers(
  opts: {
    limit?: number;
    offset?: number;
    search?: string;
    includeDeleted?: boolean;
    sort?: "createdAt" | "referrals" | "invitedBy";
    sortDir?: "asc" | "desc";
  },
  init?: RequestInit,
): Promise<{ users: AdminUser[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.search) params.set("search", opts.search);
  if (opts.includeDeleted) params.set("includeDeleted", "true");
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.sortDir) params.set("sortDir", opts.sortDir);
  const res = await adminFetch(`/admin/users?${params}`, init);
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}

export async function fetchAdminBusinessStatusRequests(opts?: {
  status?: "submitted" | "approved" | "rejected" | "revision_required";
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminBusinessStatusRequest[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const res = await adminFetch(`/admin/business-status-requests?${params.toString()}`);
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}

export async function moderateAdminBusinessStatusRequest(
  requestId: string,
  action: "approve" | "reject" | "revision",
  adminComment?: string,
): Promise<void> {
  const res = await adminFetch(`/admin/business-status-requests/${encodeURIComponent(requestId)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminComment: adminComment?.trim() || undefined }),
  });
  if (!res.ok) {
    throw await toApiRequestError(res);
  }
}

export async function fetchAdminUser(id: string): Promise<AdminUser | null> {
  const res = await adminFetch(`/admin/users/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}

/** Профиль + связанные по сигналам регистрации (для модерации). */
export async function fetchAdminUserSignupInsight(
  userId: string,
  opts?: { relatedLimit?: number },
): Promise<{ user: AdminUser; related: AdminUserSignupRelatedGroups; hint: string }> {
  const lim = Math.min(Math.max(opts?.relatedLimit ?? 40, 5), 100);
  const res = await adminFetch(`/admin/users/${userId}/signup-related?limit=${lim}`);
  if (res.status === 404) throw new Error("Пользователь не найден");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Ошибка загрузки");
  }
  return res.json();
}

export type AdminUserSignupRelatedGroups = {
  byDeviceId: AdminUser[];
  byIp: AdminUser[];
  byUaHash: AdminUser[];
  byClientSignalsHash: AdminUser[];
};

export async function updateAdminUser(
  id: string,
  payload: Partial<Pick<AdminUser, "displayName" | "surname" | "referralLimit" | "boardApiHubPrimeCode" | "publicId">> & {
    status?: string;
    city?: string;
    bio?: string;
  }
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

/** Массовая блокировка (до 100 за запрос). */
export async function bulkBanUsers(ids: string[], reason?: string): Promise<{ affected: number }> {
  const res = await adminFetch("/admin/users/bulk-ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, reason: reason ?? "" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Ошибка массовой блокировки");
  }
  return res.json() as Promise<{ affected: number }>;
}

/** Массовое мягкое удаление (скрыть), до 100 за запрос. */
export async function bulkDeleteUsers(ids: string[]): Promise<{ affected: number }> {
  const res = await adminFetch("/admin/users/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Ошибка массового удаления");
  }
  return res.json() as Promise<{ affected: number }>;
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

/** Безвозвратное удаление пользователя из БД (только admin/super_admin на сервере). */
export async function banAndPurgeUser(id: string, confirmPublicId: number, reason?: string): Promise<void> {
  const res = await adminFetch(`/admin/users/${id}/ban-and-purge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmPublicId, reason: reason ?? "" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка полного удаления");
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
  if (!res.ok) throw await toApiRequestError(res);
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

/** Авторы для автопостинга / парсера ВК — тот же список, что в «Пользователи»; не ходит в микросервис парсера. */
export async function fetchParserUsers(search?: string, init?: RequestInit): Promise<AdminParserUser[]> {
  const { users } = await fetchAdminUsers(
    {
      limit: 80,
      offset: 0,
      search: search?.trim() || undefined,
      includeDeleted: false,
    },
    init,
  );
  return users
    .filter((u) => !u.isBlocked && !u.deletedAt)
    .map((u) => ({
      id: u.id,
      publicId: u.publicId,
      displayName: u.displayName,
      surname: u.surname,
    }));
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
  /** Подпись при создании в админке (для учёта) */
  adminNote?: string | null;
};

export type AdminReferralProgramSettings = {
  defaultInvites: number;
  repeatEnabled: boolean;
  repeatInvites: number;
  repeatAfterHours: number;
  multiUseDefaultExpiresHours: number;
};

export async function createAdminReferralCode(opts?: {
  expiresInHours?: number;
  /** Без лимита использований до даты истечения */
  multiUse?: boolean;
  /** Фиксированное число регистраций (если не multiUse) */
  maxUses?: number;
  /** Необязательная подпись: кто выдал, для какой кампании */
  adminNote?: string;
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

export async function fetchAdminReferralProgramSettings(): Promise<AdminReferralProgramSettings> {
  const res = await adminFetch("/admin/referrals/settings");
  if (!res.ok) throw new Error("Не удалось загрузить настройки приглашений");
  return res.json();
}

export async function patchAdminReferralProgramSettings(
  payload: Partial<AdminReferralProgramSettings>,
): Promise<AdminReferralProgramSettings> {
  const res = await adminFetch("/admin/referrals/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось сохранить настройки приглашений");
  }
  return res.json();
}

export type AdminInviteMoreRequestRow = {
  id: string;
  userId: string;
  message: string | null;
  createdAt: string;
  bonusInvites: number;
  displayName: string | null;
  surname: string | null;
  publicId: number;
};

export async function fetchAdminInviteMoreRequests(): Promise<AdminInviteMoreRequestRow[]> {
  const res = await adminFetch("/admin/invite-more-requests");
  if (!res.ok) throw new Error("Не удалось загрузить заявки");
  const data = await res.json();
  return Array.isArray(data.requests) ? data.requests : [];
}

export async function patchAdminInviteMoreRequest(
  id: string,
  payload: { action: "approve" | "reject"; bonusInvites?: number }
): Promise<void> {
  const res = await adminFetch(`/admin/invite-more-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось обработать заявку");
  }
}

export type AdminHelpPageRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
  updatedAt: string;
};

export async function fetchAdminHelpPages(): Promise<AdminHelpPageRow[]> {
  const res = await adminFetch("/admin/help-pages");
  if (!res.ok) throw new Error("Не удалось загрузить справки");
  const data = await res.json();
  return Array.isArray(data.pages) ? data.pages : [];
}

export async function updateAdminHelpPage(
  slug: string,
  payload: { title?: string; body?: string; sortOrder?: number }
): Promise<AdminHelpPageRow> {
  const res = await adminFetch(`/admin/help-pages/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось сохранить");
  }
  return res.json();
}

export async function createAdminHelpPage(payload: {
  slug: string;
  title: string;
  body?: string;
  sortOrder?: number;
}): Promise<AdminHelpPageRow> {
  const res = await adminFetch("/admin/help-pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось создать");
  }
  return res.json();
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

// ── Group chats (admin) ──────────────────────────────────────

export type AdminGroupChat = {
  id: string;
  type: string;
  name: string | null;
  avatarUrl: string | null;
  inviteCode: string | null;
  inviteLink: string | null;
  createdAt: string;
};

export type AdminCreateGroupChatResult = {
  chat: {
    id: string;
    type: string;
    name: string | null;
    avatarUrl: string | null;
    inviteCode: string;
    createdAt: string;
  };
  inviteLink: string;
  creator: {
    id: string;
    publicId: number;
    displayName: string | null;
  };
};

export async function adminCreateGroupChat(body: {
  creatorUserId: string;
  name?: string;
  avatarUrl?: string;
}): Promise<AdminCreateGroupChatResult> {
  const res = await adminFetch("/admin/group-chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось создать групповой чат");
  }
  return res.json();
}

export async function adminUploadGroupChatAvatar(
  chatId: string,
  file: File,
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await adminFetch(`/admin/group-chats/${chatId}/avatar`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "Не удалось загрузить аватар чата");
  }
  return res.json();
}

export async function adminListGroupChats(): Promise<{ chats: AdminGroupChat[] }> {
  const res = await adminFetch("/admin/group-chats");
  if (!res.ok) throw await toApiRequestError(res);
  return res.json();
}
