/**
 * Возврат на «глубокую» ссылку после входа / регистрации / онбординга.
 * Только внутренние пути приложения — без open redirect.
 */

const STORAGE_KEY = "ping_moot_pending_auth_return";

function normalizePath(path: string): string {
  const t = path.trim();
  if (!t || t === "/") return "";
  return t.startsWith("/") ? t : `/${t}`;
}

/**
 * Разрешённые префиксы: пост в профиле, лента, companion, чаты и т.д.
 * Не включаем `/admin`.
 */
export function isSafeInternalReturnPath(pathWithQuery: string): boolean {
  const pathOnly = normalizePath(pathWithQuery.split("?")[0] ?? "");
  if (!pathOnly || pathOnly === "/") return false;
  if (pathOnly.startsWith("//")) return false;
  if (pathOnly.startsWith("/admin")) return false;

  if (pathOnly.startsWith("/u/")) return true;
  if (pathOnly.startsWith("/profile/")) return true;
  /** Старые ссылки `/id/:publicId` → редирект на профиль */
  if (pathOnly.startsWith("/id/")) return true;
  if (pathOnly === "/posts" || pathOnly.startsWith("/posts/")) return true;
  if (pathOnly.startsWith("/chat/")) return true;
  /** Приглашение в групповой чат: после входа/онбординга вернуть на страницу join. */
  if (pathOnly.startsWith("/invite/")) {
    const code = pathOnly.slice("/invite/".length).split("/")[0]?.trim() ?? "";
    return code.length > 0;
  }
  if (pathOnly.startsWith("/edge/")) return true;
  if (pathOnly === "/board" || pathOnly.startsWith("/board/")) return true;
  if (pathOnly === "/notifications" || pathOnly.startsWith("/notifications/")) return true;
  if (pathOnly === "/saved" || pathOnly.startsWith("/saved/")) return true;
  if (pathOnly === "/subscribers" || pathOnly.startsWith("/subscribers/")) return true;
  if (pathOnly.startsWith("/help/")) return true;
  if (pathOnly === "/create-post" || pathOnly.startsWith("/create-post/")) return true;
  /** Не запоминаем настройки: после входа пользователь должен попадать в чаты (fallback `/`), а не в «Профиль». */
  return false;
}

/** Сохранить URL для перехода после успешной авторизации и (при необходимости) онбординга. */
export function stashPendingAuthReturn(pathWithQuery: string): void {
  const trimmed = pathWithQuery.trim().split("#")[0] ?? "";
  if (!isSafeInternalReturnPath(trimmed)) return;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

/**
 * Запомнить «куда вернуть» для гостя: текущий путь или параметры ?next= / ?return= / ?redirect=
 * (если основной путь не подходит, например открыли `/` с `?next=/profile/5`).
 */
export function stashPendingAuthReturnFromWindow(): void {
  if (typeof window === "undefined") return;
  const pathWithQuery = window.location.pathname + window.location.search;
  if (isSafeInternalReturnPath(pathWithQuery)) {
    stashPendingAuthReturn(pathWithQuery);
    return;
  }
  const sp = new URLSearchParams(window.location.search);
  for (const key of ["next", "return", "redirect"] as const) {
    const raw = sp.get(key)?.trim();
    if (!raw) continue;
    let candidate = raw;
    try {
      candidate = decodeURIComponent(raw);
    } catch {
      candidate = raw;
    }
    const noHash = candidate.split("#")[0]?.trim() ?? "";
    if (!noHash.startsWith("/") || noHash.startsWith("//")) continue;
    if (isSafeInternalReturnPath(noHash)) {
      stashPendingAuthReturn(noHash);
      return;
    }
  }
}

/**
 * Забрать сохранённый путь (один раз) или fallback.
 */
export function consumePendingAuthReturn(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    if (raw && isSafeInternalReturnPath(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function hasCompleteProfileForRedirect(user: {
  displayName?: string | null;
  surname?: string | null;
}): boolean {
  return Boolean(user.displayName?.trim() && user.surname?.trim());
}
