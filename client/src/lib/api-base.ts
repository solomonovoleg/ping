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

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
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

/** Токен для Bearer-авторизации в нативном приложении (куки там не уходят на cross-origin). Сохраняем в localStorage, чтобы сессия переживала перезапуск приложения. */
let authToken: string | null = readStoredToken();
export function setAuthToken(token: string | null): void {
  authToken = token;
  writeStoredToken(token);
}
export function getAuthToken(): string | null {
  return authToken;
}
/** Заголовки для запросов: Bearer подставляем всегда, когда есть токен (веб и натив). Так чаты/сообщения/профили работают даже если куки не уходят (cross-origin, другой поддомен). */
export function getAuthHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

type ApiFetchInit = RequestInit & {
  /** Не считать 401 истечением сессии (локальный/опциональный запрос). */
  suppressSessionExpireOn401?: boolean;
};

/** fetch к нашему API: подставляет Bearer в нативе, в вебе только credentials. При 401 сбрасывает токен и шлёт событие auth:session-expired. Для опциональных запросов (push-token, calls/token) 401 не считаем «сессия истекла». */
export function apiFetch(url: string, init?: ApiFetchInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  Object.entries(getAuthHeaders()).forEach(([k, v]) => headers.set(k, v));
  return fetch(url, { ...init, credentials: init?.credentials ?? "include", headers }).then(
    (res) => {
      if (res.status === 401) {
        const isOptionalAuth =
          init?.suppressSessionExpireOn401 === true ||
          /\/push-token\/?$|\/push-token\?/.test(url) ||
          url.includes("push-token") ||
          /\/calls\/token\/?$|\/calls\/token\?/.test(url) ||
          url.includes("/calls/token");
        if (!isOptionalAuth) {
          setAuthToken(null);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:session-expired"));
          }
        }
      }
      return res;
    }
  );
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
