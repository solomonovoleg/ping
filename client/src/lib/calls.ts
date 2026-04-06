/**
 * Call WS token + URL utilities.
 * Used by RealtimeSocketTransport for WebSocket connection auth.
 * Everything else (ICE config, media constraints, SDP) moved to features/call/.
 */
import { API, getApiBase, apiFetch } from "@/lib/api-base";
import { isNative } from "@/lib/capacitor-native";
import { CALL_WS_SUBPROTOCOL } from "@shared/ws-call-handshake";

export class CallTokenUnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "CallTokenUnauthorizedError";
  }
}

export async function getCallToken(): Promise<string> {
  const res = await apiFetch(`${API}/calls/token`, { method: "POST", suppressSessionExpireOn401: true });
  if (res.status === 401) throw new CallTokenUnauthorizedError();
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(
        "Сервер временно не отвечает (ошибка шлюза). Обновите страницу или повторите через минуту — без токена звонки и камера в эфире не поднимутся.",
      );
    }
    throw new Error(err?.message || "Не удалось получить токен звонка. Проверьте интернет.");
  }
  const data = (await res.json()) as { token: string };
  if (!data?.token) throw new Error("Сервер не вернул токен звонка");
  return data.token;
}

function trimHttpBase(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * `https://host` → `wss://host`, `http://host` → `ws://host`. Уже ws(s) — без изменений.
 * Без этого при `http://` в env получался невалидный URL вида `http://host/calls` для WebSocket.
 */
export function httpOriginToWsOrigin(base: string): string {
  const t = trimHttpBase(base);
  if (/^wss:\/\//i.test(t) || /^ws:\/\//i.test(t)) return t;
  if (/^https:\/\//i.test(t)) return t.replace(/^https:\/\//i, "wss://");
  if (/^http:\/\//i.test(t)) return t.replace(/^http:\/\//i, "ws://");
  return t;
}

/**
 * HTTP(S) origin for WebSocket paths `/calls` and `/group-calls` (always at site root on nginx).
 * REST uses `/api/*`; if `VITE_API_URL` is `https://host/api`, we must not build `wss://host/api/calls`.
 * На нативе используем {@link getApiBase} при каждом вызове (не кэш импорта).
 */
export function getRealtimeWebSocketHttpBase(): string | null {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_URL) {
    let u = trimHttpBase(String(import.meta.env.VITE_WS_URL));
    if (/^wss:\/\//i.test(u)) u = u.replace(/^wss:\/\//i, "https://");
    else if (/^ws:\/\//i.test(u)) u = u.replace(/^ws:\/\//i, "http://");
    return u.replace(/\/api$/i, "");
  }
  const apiBase = getApiBase();
  if (apiBase) return trimHttpBase(apiBase).replace(/\/api$/i, "");
  return null;
}

/** Base `wss://…/calls` URL without secrets (token via Sec-WebSocket-Protocol). */
export function getCallWsUrl(): string {
  const wsBase = getRealtimeWebSocketHttpBase();
  if (wsBase) {
    return `${httpOriginToWsOrigin(wsBase)}/calls`;
  }
  const base = typeof window !== "undefined" ? window.location : { protocol: "http:", host: "localhost" };
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3080";
  const url = `${protocol}//${host}/calls`;
  if (import.meta.env.DEV && isNative()) {
    console.warn(
      "[calls] WebSocket URL из window.location (capacitor://…?) — проверьте VITE_API_URL / VITE_WS_URL в prod-сборке:",
      url,
    );
  }
  return url;
}

/** Opens /calls with one-time token in subprotocol (not in URL). */
export function openCallRealtimeWebSocket(token: string): WebSocket {
  return new WebSocket(getCallWsUrl(), [CALL_WS_SUBPROTOCOL, token]);
}
