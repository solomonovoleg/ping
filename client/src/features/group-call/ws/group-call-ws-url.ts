import { getCallToken } from "@/lib/calls";
import { API_BASE } from "@/lib/api-base";

const WS_BASE = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_URL) {
    return String(import.meta.env.VITE_WS_URL).replace(/\/$/, "");
  }
  if (API_BASE) return String(API_BASE).replace(/\/$/, "");
  return null;
})();

export function buildGroupCallWsUrl(token: string): string {
  if (WS_BASE) {
    const wsOrigin = WS_BASE.replace(/^https:\/\//i, "wss://");
    return `${wsOrigin}/group-calls?token=${encodeURIComponent(token)}`;
  }
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3080";
  return `${protocol}//${host}/group-calls?token=${encodeURIComponent(token)}`;
}

export async function connectGroupCallWebSocket(): Promise<WebSocket> {
  const token = await getCallToken();
  const url = buildGroupCallWsUrl(token);
  return new WebSocket(url);
}
