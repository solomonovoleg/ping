import { getCallToken, getRealtimeWebSocketHttpBase } from "@/lib/calls";
import { CALL_WS_SUBPROTOCOL } from "@shared/ws-call-handshake";

/** Ждём открытия сокета: иначе пользователь «висит» в connecting при ошибке nginx/токена. */
const GROUP_CALL_WS_OPEN_MS = 25_000;

/** Base `wss://…/group-calls` without token (auth via Sec-WebSocket-Protocol). */
export function buildGroupCallWsUrl(): string {
  const wsBase = getRealtimeWebSocketHttpBase();
  if (wsBase) {
    const wsOrigin = wsBase.replace(/^https:\/\//i, "wss://");
    return `${wsOrigin}/group-calls`;
  }
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3080";
  return `${protocol}//${host}/group-calls`;
}

export async function connectGroupCallWebSocket(): Promise<WebSocket> {
  const token = await getCallToken();
  const url = buildGroupCallWsUrl();
  const ws = new WebSocket(url, [CALL_WS_SUBPROTOCOL, token]);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(
        new Error(
          "Таймаут подключения к групповому созвону. Проверьте сеть и nginx: для /group-calls нужны Upgrade и Connection (см. deploy/nginx-ping-moot.conf).",
        ),
      );
    }, GROUP_CALL_WS_OPEN_MS);

    const settleOk = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      resolve();
    };

    const settleErr = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };

    ws.onopen = () => settleOk();
    ws.onerror = () =>
      settleErr(
        new Error(
          "Не удалось открыть WebSocket /group-calls. Проверьте: HTTPS → wss://, nginx location = /group-calls, на сервере GROUP_CALLS_ENABLED=1.",
        ),
      );
    ws.onclose = (ev) => {
      if (settled) return;
      settleErr(
        new Error(
          ev.code === 1006
            ? "Созвон: соединение не установлено (часто nginx не проксирует WebSocket для /group-calls)."
            : `Созвон: сервер закрыл соединение (код ${ev.code}). Обновите страницу или войдите снова.`,
        ),
      );
    };
  });

  return ws;
}
