import { isNative } from "@/lib/capacitor-native";

/** Схема авторизации и публичных ручек: `docs/API_AUTH_AND_PUBLIC.md`. */

/**
 * Базовый URL для API. В вебе пусто (относительные запросы).
 * В нативном приложении (Capacitor) задаётся через VITE_API_URL при сборке (например https://pingos.ru).
 * Если в iOS/Android билде VITE_API_URL не задан — подставляем дефолтный прод-URL, иначе чаты/запросы идут на capacitor://localhost и не грузятся.
 */
const ENV_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "";

const DEFAULT_NATIVE_API = "https://pingos.ru";

function computeApiBase(): string {
  if (ENV_BASE) return ENV_BASE;
  if (typeof window === "undefined") return "";
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return DEFAULT_NATIVE_API;
  } catch {}
  return "";
}

export const API_BASE = computeApiBase();
export const API = `${API_BASE}/api`;

const AUTH_TOKEN_KEY = "ping_auth_token";

/** Логи в консоль WKWebView (Safari → Develop → [устройство]) — при вылете сессии смотреть метку и поля. */
export function warnNativeAuth(tag: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !isNative()) return;
  try {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[ping-auth] ${tag}`, { ...detail, t: Date.now() });
    }
  } catch {
    /* ignore */
  }
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Подтянуть токен из localStorage в память (WKWebView / Capacitor: редкие рассинхроны после входа). */
export function syncAuthTokenFromStorage(): void {
  try {
    const s = readStoredToken();
    if (s && s !== authToken) authToken = s;
  } catch {
    /* ignore */
  }
}

function writeStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("Не удалось сохранить токен в хранилище", e);
    }
  }
}

async function persistAuthTokenToNativePreferences(token: string | null): Promise<void> {
  if (typeof window === "undefined" || !isNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    if (token) await Preferences.set({ key: AUTH_TOKEN_KEY, value: token });
    else await Preferences.remove({ key: AUTH_TOKEN_KEY });
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[auth] Capacitor Preferences", e);
    }
  }
}

/**
 * iOS/Android: подтянуть токен из нативного хранилища до первого /auth/me (WKWebView иногда теряет localStorage).
 */
export async function hydrateNativeAuthToken(): Promise<void> {
  if (typeof window === "undefined" || !isNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: AUTH_TOKEN_KEY });
    const v = value?.trim();
    if (!v) return;
    syncAuthTokenFromStorage();
    // Preferences — источник правды при рассинхроне с памятью/localStorage (WKWebView).
    if (getAuthToken() !== v) setAuthToken(v);
  } catch {
    /* ignore */
  }
}

/** Токен для Bearer-авторизации в нативном приложении (куки там не уходят на cross-origin). localStorage + на нативе Capacitor Preferences. */
let authToken: string | null = readStoredToken();
export function setAuthToken(token: string | null): void {
  const normalized =
    token != null && String(token).trim().length > 0 ? String(token).trim() : null;
  authToken = normalized;
  writeStoredToken(normalized);
  void persistAuthTokenToNativePreferences(normalized);
}
export function getAuthToken(): string | null {
  syncAuthTokenFromStorage();
  return authToken;
}
/** Заголовки для запросов: Bearer подставляем всегда, когда есть токен (веб и натив). Так чаты/сообщения/профили работают даже если куки не уходят (cross-origin, другой поддомен). */
export function getAuthHeaders(): Record<string, string> {
  syncAuthTokenFromStorage();
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

type ApiFetchInit = RequestInit & {
  /** Не считать 401 истечением сессии (локальный/опциональный запрос). */
  suppressSessionExpireOn401?: boolean;
};

function shouldLogAuth401Debug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const enabledByFlag = window.localStorage.getItem("ping_debug_auth_401") === "1";
    return !!import.meta.env?.DEV || enabledByFlag;
  } catch {
    return !!import.meta.env?.DEV;
  }
}

function getRequestPathForDebug(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/** fetch к нашему API: подставляет Bearer, credentials. При 401 — один повтор после sync токена из storage (гонка после логина на iOS), затем сброс сессии только для запросов, которые изначально стартовали уже с авторизацией. Опциональные запросы: suppressSessionExpireOn401. */
export function apiFetch(url: string, init?: ApiFetchInit): Promise<Response> {
  const isOptional401 = () =>
    init?.suppressSessionExpireOn401 === true ||
    /\/push-token\/?$|\/push-token\?/.test(url) ||
    url.includes("push-token") ||
    /\/calls\/token\/?$|\/calls\/token\?/.test(url) ||
    url.includes("/calls/token");

  const runFetch = (): Promise<Response> => {
    syncAuthTokenFromStorage();
    const hadAuthAtStart = !!getAuthToken();
    const debug401 = shouldLogAuth401Debug();
    const requestPath = getRequestPathForDebug(url);
    let nativeRecoverBeforeLogoutDone = false;

    const doFetch = (isRetry: boolean): Promise<Response> => {
      syncAuthTokenFromStorage();
      const tokenAtRequest = getAuthToken();
      const headers = new Headers(init?.headers);
      if (tokenAtRequest) {
        headers.set("Authorization", `Bearer ${tokenAtRequest}`);
      }
      return fetch(url, { ...init, credentials: init?.credentials ?? "include", headers }).then(async (res) => {
        if (res.status !== 401) return res;
        const latestToken = getAuthToken();
        const optional401 = isOptional401();
        const requestId = res.headers.get("x-request-id") || null;
        if (debug401 && typeof console !== "undefined" && console.warn) {
          console.warn("[auth-401-debug]", {
            request: requestPath,
            method: init?.method ?? "GET",
            requestId,
            isRetry,
            optional401,
            hadAuthAtStart,
            hadAuthOnRequest: !!tokenAtRequest,
            hasLatestAuth: !!latestToken,
            tokenChangedDuringRequest: !!latestToken && latestToken !== tokenAtRequest,
          });
        }
        if (optional401) return res;
        // iOS/Android: чат грузит несколько запросов сразу; Bearer мог не подставиться (токен ещё только в Preferences).
        if (!isRetry && isNative()) {
          await hydrateNativeAuthToken();
          syncAuthTokenFromStorage();
          const recovered = getAuthToken();
          if (recovered && recovered !== tokenAtRequest) {
            return doFetch(true);
          }
        }
        // Если токен поменялся между стартом и ответом (типично сразу после login на iOS), пробуем ещё раз.
        if (!isRetry && latestToken && latestToken !== tokenAtRequest) {
          return doFetch(true);
        }
        if (!isRetry && tokenAtRequest) {
          return doFetch(true);
        }
        // Запрос был запущен до логина (без токена) — его 401 не должен сбрасывать уже созданную сессию.
        if (!hadAuthAtStart) return res;
        // iOS: перед выходом ещё раз Preferences (параллельные 401 или поздняя запись после очистки LS).
        if (isNative() && !nativeRecoverBeforeLogoutDone) {
          nativeRecoverBeforeLogoutDone = true;
          await hydrateNativeAuthToken();
          syncAuthTokenFromStorage();
          if (getAuthToken()) {
            return doFetch(true);
          }
        }
        warnNativeAuth("session_cleared_after_401", { path: requestPath, method: init?.method ?? "GET" });
        setAuthToken(null);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth:session-expired"));
        }
        return res;
      });
    };

    return doFetch(false);
  };

  // WKWebView иногда очищает localStorage, токен остаётся в Preferences: без этого в памяти остаётся старый Bearer → /auth/me даёт {} и refetch сбрасывает сессию.
  const needsNativeLsHeal =
    typeof window !== "undefined" && isNative() && readStoredToken() == null;
  if (needsNativeLsHeal) {
    return hydrateNativeAuthToken()
      .then(() => {
        syncAuthTokenFromStorage();
      })
      .then(runFetch);
  }

  return Promise.resolve().then(runFetch);
}

/** База для медиа (картинки, голос) — в приложении всегда полный URL, иначе запрос уйдёт на capacitor://localhost и не загрузится */
function getUploadsBase(): string {
  if (API_BASE) return API_BASE;
  if (typeof window === "undefined") return "";
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return DEFAULT_NATIVE_API;
  } catch {}
  return window.location.origin;
}

/** Относительный путь (/uploads/...) → полный URL; data: URL возвращаем как есть. В приложении даёт https://... чтобы голос/фото грузились с сервера. */
export function resolveUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  const u = url.trim();
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${getUploadsBase().replace(/\/$/, "")}${u.startsWith("/") ? u : `/${u}`}`;
}
