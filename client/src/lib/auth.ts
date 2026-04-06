import {
  API,
  apiFetch,
  getAuthToken,
  hydrateNativeAuthToken,
  messageForFetchFailure,
  postFormDataWithUploadProgress,
  humanizeUploadOrNetworkError,
  setAuthToken,
  syncAuthTokenFromStorage,
} from "@/lib/api-base";
import { isNative } from "@/lib/capacitor-native";
import { CHAT_VIBE_PREFS_CHANGED } from "@/lib/chat-vibe-prefs";
import { collectClientSignalsForSignup, ensureDeviceIdCookie } from "@/lib/device-id";

export type AuthUser = {
  id: string;
  publicId: number;
  /** Номер не отдаётся API; после входа можно хранить только локально из формы, не из /me */
  phone?: string | null;
  displayName: string | null;
  surname: string | null;
  /** Плашка @ в шапке профиля */
  nickname?: string | null;
  gender: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  coverUrl?: string | null;
  showCover?: boolean;
  profileLink?: string | null;
  platformRole?: string;
  hideFromSearch?: boolean;
  bio?: string | null;
  /** Включены ли пуш-уведомления о новых сообщениях */
  pushEnabled?: boolean;
  /** Адаптивная атмосфера в личных чатах */
  vibeEnabled?: boolean;
  vibeShareWithPartner?: boolean;
  /** Город (необязательно) */
  city?: string | null;
  /** ISO: дата регистрации (онбординг первых 24 ч) */
  createdAt?: string | null;
  /** Кто может писать в ЛС: all | followers | mutual */
  dmPolicy?: "all" | "followers" | "mutual";
  /** Кто может добавлять в группы: all | followers | mutual */
  groupAddMePolicy?: "all" | "followers" | "mutual";
  /** Доступ к разделу API HUB на Борде (PRIME CODE назначен в админке) */
  boardApiHubAccess?: boolean;
  /** Бизнес-статус аккаунта (модерация через заявки). */
  businessStatus?: "none" | "pending" | "approved" | "rejected" | "revision_required";
  /** Публичный бизнес-контакт (только для approved). */
  businessContactPhone?: string | null;
  /** Публичный бизнес-адрес (только для approved). */
  businessAddress?: string | null;
};

/** Как на сервере: en/ru и короткие коды → male|female|other; иначе null. */
export function normalizeGenderFromApi(raw: unknown): string | null {
  if (raw === true || raw === false) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    if (n === 1) return "male";
    if (n === 2) return "female";
    if (n === 3) return "other";
  }
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "male" || v === "мужской" || v === "m" || v === "man" || v === "м") return "male";
  if (v === "female" || v === "женский" || v === "f" || v === "woman" || v === "w" || v === "ж") return "female";
  if (v === "other" || v === "другое" || v === "o" || v === "x") return "other";
  return null;
}

const AUTH_ME_CACHE_KEY = "ping_auth_me_cache";

function readAuthMeCacheFromLs(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_ME_CACHE_KEY);
    if (!raw) return null;
    return userFromMePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Подтянуть снимок профиля из Capacitor Preferences в localStorage (как с токеном). */
export async function hydrateNativeAuthMeCache(): Promise<void> {
  if (typeof window === "undefined" || !isNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: AUTH_ME_CACHE_KEY });
    if (!value?.trim()) return;
    try {
      if (!localStorage.getItem(AUTH_ME_CACHE_KEY)) {
        localStorage.setItem(AUTH_ME_CACHE_KEY, value);
      }
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

async function persistAuthMeCacheNative(json: string | null): Promise<void> {
  if (typeof window === "undefined" || !isNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    if (json) await Preferences.set({ key: AUTH_ME_CACHE_KEY, value: json });
    else await Preferences.remove({ key: AUTH_ME_CACHE_KEY });
  } catch {
    /* ignore */
  }
}

export async function saveAuthMeCache(user: AuthUser): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { phone: _omit, ...rest } = user;
    const json = JSON.stringify(rest);
    localStorage.setItem(AUTH_ME_CACHE_KEY, json);
    await persistAuthMeCacheNative(json);
  } catch {
    /* ignore */
  }
}

export async function clearAuthMeCache(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_ME_CACHE_KEY);
    await persistAuthMeCacheNative(null);
  } catch {
    /* ignore */
  }
}

function userFromMePayload(data: unknown): AuthUser | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.id !== "string") return null;
  const businessStatusRaw = d.businessStatus;
  const businessStatus =
    businessStatusRaw === "none" ||
    businessStatusRaw === "pending" ||
    businessStatusRaw === "approved" ||
    businessStatusRaw === "rejected" ||
    businessStatusRaw === "revision_required"
      ? businessStatusRaw
      : "none";
  return {
    id: d.id,
    publicId: typeof d.publicId === "number" ? d.publicId : 100,
    phone: typeof d.phone === "string" ? d.phone : null,
    displayName: (d.displayName as string | null | undefined) ?? null,
    surname: (d.surname as string | null | undefined) ?? null,
    nickname: (d.nickname as string | null | undefined) ?? null,
    gender: normalizeGenderFromApi(d.gender),
    birthDate: (d.birthDate as string | null | undefined) ?? null,
    avatarUrl: (d.avatarUrl as string | null | undefined) ?? null,
    coverUrl: (d.coverUrl as string | null | undefined) ?? null,
    showCover: d.showCover !== false,
    profileLink: (d.profileLink as string | null | undefined) ?? null,
    platformRole: (d.platformRole as string | undefined) ?? "user",
    hideFromSearch: d.hideFromSearch === true,
    bio: (d.bio as string | null | undefined) ?? null,
    pushEnabled: d.pushEnabled !== false,
    vibeEnabled: d.vibeEnabled === true,
    vibeShareWithPartner: d.vibeShareWithPartner === true,
    city: (d.city as string | null | undefined) ?? null,
    createdAt: typeof d.createdAt === "string" && d.createdAt.trim() ? d.createdAt.trim() : null,
    boardApiHubAccess: d.boardApiHubAccess === true,
    businessStatus,
    businessContactPhone: (d.businessContactPhone as string | null | undefined) ?? null,
    businessAddress: (d.businessAddress as string | null | undefined) ?? null,
  };
}

export async function fetchMe(): Promise<AuthUser | null> {
  const doReq = () =>
    apiFetch(`${API}/auth/me`, {
      credentials: "include",
      cache: "no-store",
      suppressSessionExpireOn401: true,
    });

  await hydrateNativeAuthToken();
  await hydrateNativeAuthMeCache();
  syncAuthTokenFromStorage();

  const runOnce = async (): Promise<AuthUser | null> => {
    const res = await doReq();
    if (res.status === 401) {
      await clearAuthMeCache();
      setAuthToken(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }
      return null;
    }
    if (res.status === 403) {
      await clearAuthMeCache();
      setAuthToken(null);
      return null;
    }
    if (!res.ok) {
      throw new Error(`auth_me_${res.status}`);
    }
    const data = await res.json().catch(() => ({}));
    const parsed = userFromMePayload(data);
    if (parsed) await saveAuthMeCache(parsed);
    return parsed;
  };

  try {
    let u = await runOnce();
    if (u) return u;

    if (isNative()) {
      await hydrateNativeAuthToken();
      await hydrateNativeAuthMeCache();
      syncAuthTokenFromStorage();
      if (getAuthToken()) {
        u = await runOnce();
        if (u) return u;
      }
      await new Promise((r) => setTimeout(r, 220));
      await hydrateNativeAuthToken();
      await hydrateNativeAuthMeCache();
      syncAuthTokenFromStorage();
      if (getAuthToken()) {
        u = await runOnce();
        if (u) return u;
      }
    }
    if (getAuthToken()) {
      const cached = readAuthMeCacheFromLs();
      if (cached) return cached;
    }
    return null;
  } catch {
    await hydrateNativeAuthMeCache();
    syncAuthTokenFromStorage();
    if (getAuthToken()) {
      const cached = readAuthMeCacheFromLs();
      if (cached) return cached;
    }
    return null;
  }
}

export async function login(phone: string, password: string): Promise<AuthUser & { token?: string }> {
  let res: Response;
  try {
    res = await apiFetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, password }),
      suppressSessionExpireOn401: true,
    });
  } catch (e) {
    throw new Error(messageForFetchFailure(e));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && typeof data.message === "string" && data.message.trim()) ||
      (res.status === 401 ? "Неверный номер или пароль" : null) ||
      (res.status === 503
        ? "Сервер временно недоступен. Попробуйте позже."
        : "Не удалось войти. Попробуйте снова.");
    throw new Error(msg);
  }
  const rawTok = (data as { token?: unknown })?.token;
  const tokenStr =
    rawTok != null && String(rawTok).trim().length > 0 ? String(rawTok).trim() : null;
  setAuthToken(tokenStr);
  const u = userFromMePayload(data);
  if (u) {
    await saveAuthMeCache(u);
    return { ...u, ...(tokenStr ? { token: tokenStr } : {}) };
  }
  return { ...(data as AuthUser), ...(tokenStr ? { token: tokenStr } : {}) };
}

export async function register(
  phone: string,
  password: string,
  referralCode?: string,
  phoneVerificationTicket?: string,
): Promise<AuthUser> {
  const deviceId = ensureDeviceIdCookie();
  const clientSignals = collectClientSignalsForSignup();
  const body: {
    phone: string;
    password: string;
    referralCode?: string;
    deviceId: string;
    clientSignals: Record<string, unknown>;
  } = { phone, password, deviceId, clientSignals };
  if (referralCode?.trim()) body.referralCode = referralCode.trim();
  if (phoneVerificationTicket?.trim()) {
    (body as { phoneVerificationTicket?: string }).phoneVerificationTicket = phoneVerificationTicket.trim();
  }
  let res: Response;
  try {
    res = await apiFetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
      suppressSessionExpireOn401: true,
    });
  } catch (e) {
    throw new Error(messageForFetchFailure(e));
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const m =
      errBody && typeof (errBody as { message?: unknown }).message === "string"
        ? String((errBody as { message: string }).message).trim()
        : "";
    throw new Error(m || "Не удалось зарегистрироваться. Попробуйте снова.");
  }
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") {
    setAuthToken(null);
    throw new Error("Неверный ответ сервера при регистрации");
  }
  const rawTok = (data as { token?: unknown }).token;
  const token =
    rawTok != null && String(rawTok).trim().length > 0 ? String(rawTok).trim() : null;
  setAuthToken(token);
  const user = data.user ?? data;
  const parsed = userFromMePayload(typeof user === "object" && user ? user : null);
  if (parsed) {
    await saveAuthMeCache(parsed);
    const out: AuthUser & { token?: string } = { ...parsed };
    if (token) out.token = token;
    return out;
  }
  const out: AuthUser & { token?: string } = {
    id: String(user?.id ?? ""),
    publicId: typeof user?.publicId === "number" ? user.publicId : 0,
    phone: null,
    displayName: typeof user?.displayName === "string" ? user.displayName : null,
    surname: typeof user?.surname === "string" ? user.surname : null,
    avatarUrl: typeof user?.avatarUrl === "string" ? user.avatarUrl : null,
    gender: normalizeGenderFromApi((user as { gender?: unknown }).gender),
    birthDate: typeof user?.birthDate === "string" ? user.birthDate : null,
    createdAt:
      typeof (user as { createdAt?: unknown }).createdAt === "string"
        ? String((user as { createdAt: string }).createdAt).trim() || null
        : null,
  };
  if (token) out.token = token;
  return out;
}

export type PhoneVerificationConfig = {
  phoneCallVerificationRequired: boolean;
  /** Флаг из админки (без учёта New-Tel). */
  registrationPhoneCallVerificationEnabled?: boolean;
  /** Зарезервировано; всегда false (раньше использовалось для legacy env). */
  forcedByEnv?: boolean;
};

function coercePhoneVerificationBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Нужен ли шаг подтверждения звонком при регистрации (совпадает с логикой сервера /register). */
export async function fetchPhoneVerificationConfig(): Promise<PhoneVerificationConfig> {
  const res = await apiFetch(`${API}/auth/phone-verification/config`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as {
    phoneCallVerificationRequired?: unknown;
    registrationPhoneCallVerificationEnabled?: unknown;
    forcedByEnv?: unknown;
    message?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Не удалось получить настройки регистрации",
    );
  }
  return {
    phoneCallVerificationRequired: coercePhoneVerificationBool(data.phoneCallVerificationRequired),
    registrationPhoneCallVerificationEnabled: coercePhoneVerificationBool(data.registrationPhoneCallVerificationEnabled),
    forcedByEnv: coercePhoneVerificationBool(data.forcedByEnv),
  };
}

export type StartPhoneVerificationSuccess = {
  challengeId: string;
  expiresAt: string;
  confirmationNumber: string;
  qrCodeUri: string | null;
};

export async function startPhoneVerification(phone: string): Promise<StartPhoneVerificationSuccess> {
  const res = await apiFetch(`${API}/auth/phone-verification/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ phone }),
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: unknown;
    message?: unknown;
    challengeId?: unknown;
    expiresAt?: unknown;
    confirmationNumber?: unknown;
    qrCodeUri?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      (typeof data.message === "string" ? data.message : null) || "Не удалось начать подтверждение номера",
    );
  }
  if (
    data.ok === true &&
    (typeof data.challengeId !== "string" || !String(data.challengeId).trim())
  ) {
    throw new Error(
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "Не удалось начать подтверждение номера",
    );
  }
  const challengeId = typeof data.challengeId === "string" ? data.challengeId.trim() : "";
  const expiresAt = typeof data.expiresAt === "string" ? data.expiresAt.trim() : "";
  const confirmationNumber =
    typeof data.confirmationNumber === "string" ? data.confirmationNumber.trim() : "";
  if (!challengeId || !expiresAt || !confirmationNumber) {
    throw new Error("Сервер вернул неполные данные подтверждения");
  }
  const qrRaw = typeof data.qrCodeUri === "string" ? data.qrCodeUri.trim() : "";
  return {
    challengeId,
    expiresAt,
    confirmationNumber,
    qrCodeUri: qrRaw || null,
  };
}

export async function confirmPhoneVerification(
  challengeId: string,
  phone: string,
  pin = "",
): Promise<{ verificationTicket: string }> {
  const res = await apiFetch(`${API}/auth/phone-verification/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ challengeId, phone, pin }),
    suppressSessionExpireOn401: true,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ||
        "Не удалось подтвердить номер",
    );
  }
  const verificationTicket =
    typeof (data as { verificationTicket?: unknown }).verificationTicket === "string"
      ? String((data as { verificationTicket: string }).verificationTicket).trim()
      : "";
  if (!verificationTicket) {
    throw new Error("Сервер вернул пустой токен подтверждения");
  }
  return { verificationTicket };
}

export async function logout(): Promise<void> {
  await apiFetch(`${API}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  setAuthToken(null);
  await clearAuthMeCache();
  try {
    const { queryClient } = await import("@/lib/queryClient");
    queryClient.clear();
  } catch {
    /* ignore */
  }
  try {
    const { clearSessionOfflineCaches } = await import("@/lib/offline-session-cache");
    await clearSessionOfflineCaches();
  } catch {
    /* ignore */
  }
}

/** Удаление своего аккаунта (требование App Store). После успеха нужно вызвать logout и перенаправить на вход. */
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch(`${API}/auth/me`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) || "Не удалось удалить аккаунт"
    );
  }
  setAuthToken(null);
  await clearAuthMeCache();
  try {
    const { queryClient } = await import("@/lib/queryClient");
    queryClient.clear();
  } catch {
    /* ignore */
  }
  try {
    const { clearSessionOfflineCaches } = await import("@/lib/offline-session-cache");
    await clearSessionOfflineCaches();
  } catch {
    /* ignore */
  }
}

/** Загружает аватар (data URL или Blob), возвращает URL картинки с сервера */
export async function uploadAvatar(
  dataUrlOrBlob: string | Blob,
  options?: { onProgress?: (percent: number) => void },
): Promise<string> {
  try {
    let file: Blob;
    if (typeof dataUrlOrBlob === "string") {
      const res = await fetch(dataUrlOrBlob);
      file = await res.blob();
    } else {
      file = dataUrlOrBlob;
    }
    const type = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    const form = new FormData();
    const bodyFile = file instanceof File ? file : new File([file], "avatar.jpg", { type });
    form.append("file", bodyFile);
    const { ok, bodyText } = await postFormDataWithUploadProgress(`${API}/upload/avatar`, form, {
      onProgress: options?.onProgress,
    });
    if (!ok) {
      let message = "Ошибка загрузки аватара";
      try {
        const err = JSON.parse(bodyText) as { message?: string };
        if (err?.message) message = err.message;
      } catch {
        if (bodyText) message = bodyText.slice(0, 200);
      }
      throw new Error(message);
    }
    const data = JSON.parse(bodyText) as { url?: string };
    if (typeof data?.url !== "string") throw new Error("Сервер не вернул URL аватара");
    return data.url;
  } catch (e) {
    throw new Error(humanizeUploadOrNetworkError(e, "Не удалось загрузить аватар"));
  }
}

/** Загрузить шапку профиля (баннер). Возвращает URL для сохранения в coverUrl. */
export async function uploadCover(file: File, options?: { onProgress?: (percent: number) => void }): Promise<string> {
  try {
    const form = new FormData();
    form.append("file", file, file.name || "cover.jpg");
    const { ok, bodyText } = await postFormDataWithUploadProgress(`${API}/upload/cover`, form, {
      onProgress: options?.onProgress,
    });
    if (!ok) {
      let message = "Ошибка загрузки шапки";
      try {
        const err = JSON.parse(bodyText) as { message?: string };
        if (err?.message) message = err.message;
      } catch {
        if (bodyText) message = bodyText.slice(0, 200);
      }
      throw new Error(message);
    }
    const data = JSON.parse(bodyText) as { url?: string };
    if (typeof data?.url !== "string") throw new Error("Сервер не вернул URL шапки");
    return data.url;
  } catch (e) {
    throw new Error(humanizeUploadOrNetworkError(e, "Не удалось загрузить шапку профиля"));
  }
}

/** Только настройки атмосферы чата — без валидации имени/пола (PATCH /users/me/vibe-settings). */
export async function patchVibeSettings(partial: {
  vibeEnabled?: boolean;
  vibeShareWithPartner?: boolean;
}): Promise<{ vibeEnabled: boolean; vibeShareWithPartner: boolean }> {
  const res = await apiFetch(`${API}/users/me/vibe-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(partial),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Не удалось сохранить";
    try {
      const err = JSON.parse(text) as { message?: string; error?: string };
      if (typeof err?.message === "string") message = err.message;
      else if (typeof err?.error === "string") message = err.error;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    const out = JSON.parse(text) as { vibeEnabled: boolean; vibeShareWithPartner: boolean };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHAT_VIBE_PREFS_CHANGED));
    }
    return out;
  } catch {
    throw new Error("Неверный ответ сервера");
  }
}

export async function updateProfile(data: {
  displayName?: string;
  surname?: string;
  nickname?: string | null;
  gender?: string;
  birthDate?: string | null;
  avatarUrl?: string;
  hideFromSearch?: boolean;
  bio?: string | null;
  coverUrl?: string | null;
  showCover?: boolean;
  profileLink?: string | null;
  city?: string | null;
  pushEnabled?: boolean;
  dmPolicy?: "all" | "followers" | "mutual";
  groupAddMePolicy?: "all" | "followers" | "mutual";
  businessContactPhone?: string | null;
  businessAddress?: string | null;
}): Promise<AuthUser> {
  const res = await apiFetch(`${API}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Ошибка обновления профиля";
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    const u = userFromMePayload(parsed);
    if (!u) throw new Error("parse");
    return u;
  } catch {
    throw new Error("Неверный ответ сервера");
  }
}
