import {
  API,
  apiFetch,
  getAuthToken,
  hydrateNativeAuthToken,
  setAuthToken,
  syncAuthTokenFromStorage,
} from "@/lib/api-base";
import { isNative } from "@/lib/capacitor-native";
import { CHAT_VIBE_PREFS_CHANGED } from "@/lib/chat-vibe-prefs";

export type AuthUser = {
  id: string;
  publicId: number;
  phone: string;
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
};

/** Как на сервере: en/ru → male|female|other; иначе null (форма профиля не теряет выбор). */
function normalizeGenderFromApi(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "male" || v === "мужской") return "male";
  if (v === "female" || v === "женский") return "female";
  if (v === "other" || v === "другое") return "other";
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
    const json = JSON.stringify(user);
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
  if (typeof d.id !== "string" || typeof d.phone !== "string") return null;
  return {
    id: d.id,
    publicId: typeof d.publicId === "number" ? d.publicId : 100,
    phone: d.phone,
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
  const res = await apiFetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ phone, password }),
    suppressSessionExpireOn401: true,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ||
        (res.status === 401 ? "Неверный номер или пароль" : "Ошибка входа")
    );
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
  referralCode?: string
): Promise<AuthUser> {
  const body: { phone: string; password: string; referralCode?: string } = { phone, password };
  if (referralCode?.trim()) body.referralCode = referralCode.trim();
  const res = await apiFetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    suppressSessionExpireOn401: true,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка регистрации");
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
  const parsed = userFromMePayload(
    typeof user === "object" && user
      ? { ...user, phone: String((user as { phone?: unknown }).phone ?? phone) }
      : null
  );
  if (parsed) {
    await saveAuthMeCache(parsed);
    const out: AuthUser & { token?: string } = { ...parsed };
    if (token) out.token = token;
    return out;
  }
  const out: AuthUser & { token?: string } = {
    id: String(user?.id ?? ""),
    publicId: typeof user?.publicId === "number" ? user.publicId : 0,
    phone: String(user?.phone ?? phone),
    displayName: typeof user?.displayName === "string" ? user.displayName : null,
    surname: typeof user?.surname === "string" ? user.surname : null,
    avatarUrl: typeof user?.avatarUrl === "string" ? user.avatarUrl : null,
    gender: normalizeGenderFromApi((user as { gender?: unknown }).gender),
    birthDate: typeof user?.birthDate === "string" ? user.birthDate : null,
  };
  if (token) out.token = token;
  return out;
}

export async function logout(): Promise<void> {
  await apiFetch(`${API}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  setAuthToken(null);
  await clearAuthMeCache();
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
}

/** Загружает аватар (data URL или Blob), возвращает URL картинки с сервера */
export async function uploadAvatar(dataUrlOrBlob: string | Blob): Promise<string> {
  let file: Blob;
  if (typeof dataUrlOrBlob === "string") {
    const res = await fetch(dataUrlOrBlob);
    file = await res.blob();
  } else {
    file = dataUrlOrBlob;
  }
  const type = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], "avatar.jpg", { type }), "avatar.jpg");
  const res = await apiFetch(`${API}/upload/avatar`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Ошибка загрузки аватара";
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    const data = JSON.parse(text) as { url?: string };
    if (typeof data?.url !== "string") throw new Error("Сервер не вернул URL аватара");
    return data.url;
  } catch {
    throw new Error("Неверный ответ сервера при загрузке аватара");
  }
}

/** Загрузить шапку профиля (баннер). Возвращает URL для сохранения в coverUrl. */
export async function uploadCover(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "cover.jpg");
  const res = await apiFetch(`${API}/upload/cover`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Ошибка загрузки шапки";
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    const data = JSON.parse(text) as { url?: string };
    if (typeof data?.url !== "string") throw new Error("Сервер не вернул URL шапки");
    return data.url;
  } catch {
    throw new Error("Неверный ответ сервера при загрузке шапки");
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
  pushEnabled?: boolean;
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
