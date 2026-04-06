# API HUB integration example

Полная модель **«вход через аккаунты PING»** и роль PRIME/`pm.*` — в **[EXTERNAL_SERVICE_AUTH_GUIDE.md](./EXTERNAL_SERVICE_AUTH_GUIDE.md)**.

## REST + OAuth

```ts
import { ApiHubClient } from "../sdk/js/src/index.js";

const hub = new ApiHubClient({
  baseUrl: "http://localhost:3092",
  partnerApiKey: "partner_demo_key",
});

const start = await hub.startOAuth({
  pingUserId: "ping_u_alex",
  externalUserId: "site_user_42",
});

const session = await hub.completeOAuth(start.code);
hub.setAccessToken(session.accessToken);

const chats = await hub.chats();
const firstChatId = chats.chats[0].id;
await hub.sendMessage(firstChatId, { kind: "text", text: "hello from external site" }, "idem-001");
```

## WebSocket: события и мост с PING

После `createRealtimeSocket()` приходят JSON-объекты **`HubRealtimeEnvelope`** (см. `sdk/js/src/realtime-types.ts` и OpenAPI `components/schemas/HubRealtimeEnvelope`).

Поле **`event`** определяет смысл **`payload`**. Сообщения, пришедшие с основного приложения PING через мост, содержат в payload **`source: "ping_platform"`** и **`recipientPingUserId`** — UUID пользователя PING, для которого предназначено уведомление (у одного партнёра может быть несколько связанных пользователей).

Рекомендуемая фильтрация на стороне сайта:

```ts
import {
  ApiHubClient,
  isPingPlatformBridgePayload,
  type HubRealtimeEnvelope,
} from "../sdk/js/src/index.js";

const LINKED_PING_USER_ID = "…"; // id пользователя PING, под которым открыта сессия на сайте

const ws = await hub.createRealtimeSocket();
ws.onmessage = (ev) => {
  const env = JSON.parse(ev.data as string) as HubRealtimeEnvelope;
  if (env.channel !== "message") return;

  if (isPingPlatformBridgePayload(env.payload)) {
    if (env.payload.recipientPingUserId !== LINKED_PING_USER_ID) return;
  }

  switch (env.event) {
    case "message.created":
    case "message.transcript.updated":
      // env.payload.message — как в API чата PING
      break;
    case "message.updated":
      // messageId, content
      break;
    case "message.deleted":
      // messageId
      break;
    case "message.reactions.updated":
      // messageId, reactions[], actorUserId, emoji
      break;
    default:
      break;
  }

  if (env.id) {
    ws.send(JSON.stringify({ type: "ack", eventId: env.id }));
  }
};
```

События **`message.delivered`** / **`message.read`** / **`presence.updated`** приходят из обычного потока HUB (без `source: ping_platform`), если вы их используете.

## Продакшен: мост PING → HUB (операторам)

Эндпоинт **`POST /internal/platform/chat-message`** не предназначен для браузера.

1. Задать одинаковый секрет: на HUB **`API_HUB_BRIDGE_SECRET`**, на платформе **`API_HUB_BRIDGE_SECRET`** + **`API_HUB_BRIDGE_URL`** (полный URL эндпоинта).
2. Ограничить доступ на сетевом уровне: nginx/firewall только с IP приложения PING; на HUB опционально **`API_HUB_BRIDGE_ALLOWED_IPS`** (список через запятую, без CIDR).
3. За reverse proxy включить **`API_HUB_BRIDGE_TRUST_X_FORWARDED=1`** на HUB и один hop `trust proxy`, чтобы allowlist видел реальный клиентский IP.
4. Метрики: **`GET /metrics/prometheus`** — счётчики `api_hub_bridge_*`; пример правил — **`prometheus-bridge-alerts.example.yml`** в этой папке.
5. Платформа шлёт заголовок **`Idempotency-Key`** автоматически. Дедуп на HUB: при **`API_HUB_REDIS_URL`** — Redis **`SET NX`** (TTL 10 мин, ключи `apihub:bridge:idem:*`), общий для реплик; без Redis — только память процесса.

Переменные ретраев на **платформе** (опционально): **`API_HUB_BRIDGE_MAX_ATTEMPTS`** (по умолчанию 3), **`API_HUB_BRIDGE_RETRY_BASE_MS`** (200), **`API_HUB_BRIDGE_TIMEOUT_MS`** (5000).

### Пример фрагмента nginx

Закрыть `/internal/` от публичного интернета; разрешить только upstream платформы:

```nginx
location /internal/ {
    allow 10.0.0.0/8;
    deny all;
    proxy_pass http://api_hub_upstream;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

(Подставьте свою подсеть/VPC; на HUB выставьте `API_HUB_BRIDGE_TRUST_X_FORWARDED=1` и при необходимости `API_HUB_BRIDGE_ALLOWED_IPS`.)
