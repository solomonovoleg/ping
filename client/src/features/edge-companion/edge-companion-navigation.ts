/**
 * Полноэкранный EDGE Companion: откуда пришли → куда ведёт «Назад».
 * Параметр `back` только для внутренних путей (без open redirect).
 */

const DEFAULT_BACK = "/posts";

function parseSearch(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw);
  } catch {
    return new URLSearchParams();
  }
}

/** Разрешённые цели возврата: лента, профиль, пост в профиле. */
export function safeEdgeCompanionBackPath(path: string | null): string | null {
  if (path == null || path === "") return null;
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  if (p.includes("://") || p.includes("\0") || p.includes("\\")) return null;
  if (p === "/posts") return p;
  if (p === "/profile/me") return p;
  if (/^\/profile\/[^/]+$/.test(p)) return p;
  if (/^\/profile\/[^/]+\/post\/[^/]+$/.test(p)) return p;
  return null;
}

export function resolveEdgeCompanionBackFromSearch(search: string): string {
  const raw = parseSearch(search).get("back");
  return safeEdgeCompanionBackPath(raw) ?? DEFAULT_BACK;
}

/**
 * Короткий путь: `/edge/{edgeId}?back=…` (back — только внутренние URL).
 * Старый `/edge/companion?edgeId=…` редиректится на этот формат.
 */
export function buildEdgeCompanionOpenHref(edgeId: string, backPath: string): string {
  const normalized = safeEdgeCompanionBackPath(backPath) ?? DEFAULT_BACK;
  const qs = new URLSearchParams();
  qs.set("back", normalized);
  const q = qs.toString();
  return `/edge/${encodeURIComponent(edgeId)}${q ? `?${q}` : ""}`;
}
