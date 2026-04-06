import { API, apiFetch } from "@/lib/api-base";

/** Не чаще одного события за интервал (снижает шум при быстром свайпе). */
const MIN_INTERVAL_MS = 10_000;
/** Не больше событий за сессию вкладки (sessionStorage). */
const SESSION_MAX = 40;
const SESSION_KEY = "ping_isee_ttfp_n";

let lastSentAt = 0;

function readSessionCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function bumpSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, String(readSessionCount() + 1));
  } catch {
    /* ignore */
  }
}

function navigatorConnectionEffectiveType(): string | null {
  try {
    const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const t = c?.effectiveType?.trim();
    return t && t.length > 0 ? t.slice(0, 32) : null;
  } catch {
    return null;
  }
}

/**
 * Замер time-to-first-play для активного слайда iSee: dev — console.debug;
 * prod/stage — POST `/api/telemetry/client-event` с throttling (см. константы выше).
 */
export function trackIseeTimeToFirstPlay(args: { ms: number; postId: string | undefined }): void {
  const postId = typeof args.postId === "string" ? args.postId.trim() : "";
  if (import.meta.env.DEV) {
    console.debug(`[iSee] time-to-first-play ms=${args.ms} post=${postId || "?"}`);
  }
  if (!postId || !Number.isFinite(args.ms) || args.ms < 0) return;

  const now = Date.now();
  if (now - lastSentAt < MIN_INTERVAL_MS) return;
  if (readSessionCount() >= SESSION_MAX) return;

  lastSentAt = now;
  bumpSession();

  void apiFetch(`${API}/telemetry/client-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "isee.time_to_first_play",
      payload: {
        ms: Math.round(args.ms),
        postId,
        connectionType: navigatorConnectionEffectiveType(),
      },
    }),
  }).catch(() => {
    /* некритичная телеметрия */
  });
}
