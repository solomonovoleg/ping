/**
 * Call WS token + URL utilities.
 * Used by RealtimeSocketTransport for WebSocket connection auth.
 * Everything else (ICE config, media constraints, SDP) moved to features/call/.
 */
import { API, API_BASE, apiFetch } from "@/lib/api-base";

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
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err?.message || "Не удалось получить токен звонка. Проверьте интернет.");
  }
  const data = (await res.json()) as { token: string };
  if (!data?.token) throw new Error("Сервер не вернул токен звонка");
  return data.token;
}

const WS_BASE = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_URL) {
    return String(import.meta.env.VITE_WS_URL).replace(/\/$/, "");
  }
  if (API_BASE) return String(API_BASE).replace(/\/$/, "");
  return null;
})();

export function getCallWsUrl(token: string): string {
  if (WS_BASE) {
    const wsOrigin = WS_BASE.replace(/^https:\/\//i, "wss://");
    return `${wsOrigin}/calls?token=${encodeURIComponent(token)}`;
  }
  const base = typeof window !== "undefined" ? window.location : { protocol: "http:", host: "localhost" };
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3080";
  return `${protocol}//${host}/calls?token=${encodeURIComponent(token)}`;
}
