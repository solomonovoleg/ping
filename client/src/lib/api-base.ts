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

/**
 * База API без `/api`. На Capacitor **нельзя** кэшировать при импорте модуля:
 * к моменту первого выполнения бандла `window.Capacitor` иногда ещё не готов → пустой base,
 * относительные URL уходят на `capacitor://localhost`, WebSocket — на `ws://localhost/calls`.
 */
export function getApiBase(): string {
  if (ENV_BASE) return ENV_BASE;
  if (typeof window === "undefined") return "";
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return DEFAULT_NATIVE_API;
  } catch {
    /* ignore */
  }
  return "";
}

export function getApiPrefix(): string {
  const b = getApiBase();
  return b ? `${b}/api` : "/api";
}

const apiPrefixCoercible = {
  toString(): string {
    return getApiPrefix();
  },
  valueOf(): string {
    return getApiPrefix();
  },
  [Symbol.toPrimitive](): string {
    return getApiPrefix();
  },
};

/** Префикс `/api` или `https://host/api` — при обращении вычисляется лениво (важно для iOS). */
export const API = apiPrefixCoercible as unknown as string;

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

export type ApiErrorPayload = {
  message?: string;
  retryable?: boolean;
  requestId?: string | null;
  timestamp?: string;
};

export class ApiRequestError extends Error {
  status: number;
  retryable: boolean;
  requestId: string | null;

  constructor(message: string, opts: { status: number; retryable: boolean; requestId: string | null }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.requestId = opts.requestId;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

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

/** Короткий текст для UI (тосты, поля формы). Длинная шпаргалка для деплоя — только в dev-консоль, см. `messageForFetchFailure`. */
const FETCH_FAILURE_USER_MESSAGE =
  "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";

const FETCH_FAILURE_DEV_HINT =
  "Часто в логе: Network error / Failed to fetch. Проверьте: VITE_API_URL в сборке; nginx client_max_body_size ≥ 550m и proxy_read_timeout для /api (deploy/nginx-ping-moot.conf); лимит Cloudflare ~100 МБ; для видео — ffmpeg на сервере.";

/**
 * Safari/WebKit часто даёт `Load failed`, Chrome — `Failed to fetch`: это не JSON от API, а обрыв/таймаут/CORS до ответа.
 * В UI возвращаем короткую фразу; в DEV дополнительно пишем подсказку в console (не для конечных пользователей).
 */
export function messageForFetchFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();
  if (
    /load failed|failed to fetch|networkerror|\bnetwork\s+error\b|network request failed|the internet connection appears to be offline|load cancelled|aborted|timeout|econnreset|socket|connection.*lost|err_internet_disconnected|не удалось подключ|status\s*0|код ответа 0|unknownerror/i.test(
      m,
    )
  ) {
    if (import.meta.env?.DEV && typeof console !== "undefined" && console.warn) {
      console.warn("[api] fetch/upload оборвался до ответа сервера:", FETCH_FAILURE_DEV_HINT, { rawMessage: raw });
    }
    return FETCH_FAILURE_USER_MESSAGE;
  }
  return raw.trim() || "Ошибка сети";
}

/** Тосты при загрузке файлов: WebKit даёт DOMException name «UnknownError» с пустым message. */
export function humanizeUploadOrNetworkError(err: unknown, fallback: string): string {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    if (err.name === "AbortError") return "Отправка отменена.";
    if (err.name === "UnknownError" || err.name === "NotReadableError") {
      return "Не удалось отправить файл. Проверьте сеть и повторите; при необходимости обновите страницу.";
    }
  }
  if (err instanceof Error) {
    const m = err.message.trim();
    if (m === "UnknownError" || /^unknownerror$/i.test(m)) {
      return "Не удалось отправить файл. Проверьте сеть и повторите; при необходимости обновите страницу.";
    }
    if (m) return m;
  }
  return fallback;
}

function normalizeRequestPath(url: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function resolveRequestTimeoutMs(url: string, init?: RequestInit): number {
  const method = String(init?.method || "GET").toUpperCase();
  const path = normalizeRequestPath(url);
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const isUpload = /\/api\/(?:upload|call-transcripts\/upload)/.test(path);
  if (isUpload) return 130_000;
  if (isMutation) return 35_000;
  return 25_000;
}

function withRequestTimeout(signal: AbortSignal | null | undefined, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/** fetch к нашему API: подставляет Bearer, credentials. При 401 — один повтор после sync токена из storage (гонка после логина на iOS), затем сброс сессии только для запросов, которые изначально стартовали уже с авторизацией. Опциональные запросы: suppressSessionExpireOn401. */
export function apiFetch(url: string, init?: ApiFetchInit): Promise<Response> {
  const isOptional401 = () =>
    init?.suppressSessionExpireOn401 === true ||
    /\/push-token\/?$|\/push-token\?/.test(url) ||
    url.includes("push-token") ||
    url.includes("voip-token") ||
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
      const timed = withRequestTimeout(init?.signal, resolveRequestTimeoutMs(url, init));
      return fetch(url, { ...init, credentials: init?.credentials ?? "include", headers, signal: timed.signal })
        .catch((err) => {
          if (err instanceof Error && err.name === "AbortError" && init?.signal?.aborted) {
            throw err;
          }
          if (err instanceof Error && err.name === "AbortError") {
            throw new Error("timeout");
          }
          throw err;
        })
        .finally(() => timed.cleanup())
        .then(async (res) => {
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

export async function toApiRequestError(res: Response): Promise<ApiRequestError> {
  let payload: ApiErrorPayload | null = null;
  try {
    payload = (await res.clone().json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }
  const requestId = payload?.requestId ?? res.headers.get("x-request-id");
  const retryable = payload?.retryable === true || res.headers.get("x-retryable") === "1";
  const baseMessage =
    typeof payload?.message === "string" && payload.message.trim().length > 0
      ? payload.message.trim()
      : `${res.status}: ${res.statusText || "Ошибка запроса"}`;
  const message = requestId ? `${baseMessage} (request-id: ${requestId})` : baseMessage;
  return new ApiRequestError(message, {
    status: res.status,
    retryable,
    requestId: requestId || null,
  });
}

/**
 * База для относительных путей медиа (/uploads/...).
 * - **Натив (Capacitor):** полный хост API (VITE_API_URL или дефолт), иначе запрос уйдёт на capacitor://localhost.
 * - **Веб:** обычно хост **страницы** (window.location.origin), чтобы при SPA на app.* и API на api.*
 *   не тянуть /uploads/ с api (nginx отдаёт файлы с основного домена).
 * - **Исключение:** origin страницы ≠ origin API (отдельный Vite, preview, телефон в LAN): /uploads/ только на сервере API.
 *   В production-сборке (`import.meta.env.PROD`) при раздельных app.* / api.* снова берём хост страницы.
 */
function getUploadsBase(): string {
  if (typeof window !== "undefined") {
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      if (cap?.isNativePlatform?.()) {
        const ab = getApiBase();
        if (ab) return ab;
        return DEFAULT_NATIVE_API;
      }
    } catch {
      /* ignore */
    }
    const origin = window.location?.origin ?? "";
    const originBase = /^https?:\/\//i.test(origin) ? origin.replace(/\/$/, "") : "";

    const apiBase = getApiBase();
    if (apiBase && originBase) {
      try {
        const apiOrigin = new URL(apiBase).origin;
        if (apiOrigin !== originBase) {
          const pageHost = new URL(originBase).hostname;
          const apiHost = new URL(apiOrigin).hostname;
          const loopback = (h: string) => h === "localhost" || h === "127.0.0.1";
          if (import.meta.env.DEV || (loopback(pageHost) && loopback(apiHost))) {
            return apiBase.replace(/\/$/, "");
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (originBase) return originBase;
  }
  const ab = getApiBase();
  if (ab) return ab;
  return "";
}

/** Относительный путь (/uploads/...) → полный URL; абсолютные и data:/blob: — как есть. */
export function resolveUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  const u = url.trim();
  const lower = u.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("data:") || lower.startsWith("blob:")) {
    return u;
  }
  return `${getUploadsBase().replace(/\/$/, "")}${u.startsWith("/") ? u : `/${u}`}`;
}

/** 0–100 по мере отправки тела запроса (multipart). */
export type UploadProgressFn = (percent: number) => void;

export type PostFormDataProgressOptions = {
  onProgress?: UploadProgressFn;
  signal?: AbortSignal;
  /** Таймаут XHR (мс). Для тяжёлого видео + перекодирование на сервере — см. `uploadPostMedia`. */
  timeoutMs?: number;
};

/**
 * POST FormData с `xhr.upload.onprogress` (fetch прогресс отправки не даёт).
 * Те же credentials + Bearer, что в apiFetch.
 */
export function postFormDataWithUploadProgress(
  url: string,
  formData: FormData,
  options?: PostFormDataProgressOptions,
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      reject(new Error("Загрузка недоступна в этой среде"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    const timeoutMs = options?.timeoutMs;
    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      xhr.timeout = timeoutMs;
    }
    syncAuthTokenFromStorage();
    const token = getAuthToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    const onAbort = () => xhr.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (!options?.onProgress || !ev.lengthComputable || ev.total <= 0) return;
      const pct = Math.min(100, Math.max(0, Math.round((ev.loaded / ev.total) * 100)));
      options.onProgress(pct);
    };

    xhr.onload = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      // WebKit / мобильные сети: при обрыве иногда приходит status 0 без тела вместо onerror.
      if (xhr.status === 0) {
        reject(new Error(messageForFetchFailure(new Error("Связь оборвалась (код ответа 0)"))));
        return;
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        bodyText: typeof xhr.responseText === "string" ? xhr.responseText : "",
      });
    };
    xhr.onerror = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new Error(messageForFetchFailure(new Error("Network error"))));
    };
    xhr.ontimeout = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new Error(messageForFetchFailure(new Error("timeout"))));
    };
    xhr.onabort = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    try {
      xhr.send(formData);
    } catch (sendErr) {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new Error(messageForFetchFailure(sendErr)));
    }
  });
}
