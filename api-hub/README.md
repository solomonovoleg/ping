# API HUB microservice

Standalone service for external-site integrations with PING auth + chat.

## Документация для внешних сервисов (вход через аккаунты PING)

**[docs/EXTERNAL_SERVICE_AUTH_GUIDE.md](./docs/EXTERNAL_SERVICE_AUTH_GUIDE.md)** — модель «без своего пароля PING», mock/OIDC, PRIME, `pm.*`, чеклист модуля на стороне партнёра и ограничения веб-callback.

## Quick start

1. Copy env:

```bash
cp api-hub/.env.example api-hub/.env
```

2. Start Postgres (optional for DB migration/seed):

```bash
docker compose -f api-hub/docker-compose.yml up -d
```

3. Migrate + seed:

```bash
npm run db:migrate --prefix api-hub
npm run db:seed --prefix api-hub
```

4. Run service:

```bash
npm run dev --prefix api-hub
```

## Endpoints

- `GET /health`, `GET /ready`
- `GET /v1/auth/ping/start`
- `GET /v1/auth/ping/callback`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/contacts`
- `GET /v1/chats`
- `GET /v1/chats/{chatId}/messages`
- `POST /v1/chats/{chatId}/messages:send`
- `POST /v1/messages/{messageId}/reactions`
- `POST /v1/messages/{messageId}/status`
- `GET /v1/realtime/token`
- `WS /v1/realtime`
- `POST /v1/presence`
- `POST /v1/media/upload-init`
- `POST /v1/media/upload-complete`
- `POST /v1/platform/chat-media` — multipart `file` → прокси на **`POST /api/upload/chat-media`** (нужен **`pm.*`**, scope **`chat.write`**); ответ как у приложения + **`pingPlatformOrigin`** для абсолютного URL
- `POST /internal/platform/chat-message` — только с **`Authorization: Bearer API_HUB_BRIDGE_SECRET`**. Тело JSON с полем **`event`** (по умолчанию **`message.created`**, если не указано — как раньше). Общие поля: **`chatId`**, **`memberUserIds`**. Дальше по событию:
  - **`message.created`** — **`message`** (объект, как в PING WS).
  - **`message.updated`** — **`messageId`**, **`content`**.
  - **`message.deleted`** — **`messageId`**.
  - **`message.reactions.updated`** — **`messageId`**, **`reactions`**, **`actorUserId`**, **`emoji`** (`string` или `null`).
  - **`message.transcript.updated`** — **`message`** (с заполненным **`transcript`**).
  Для каждой активной сессии с **`chat.read`** и `ping_user_id ∈ memberUserIds` эмитится соответствующее событие на канале **`message`** (+ webhooks / Redis fanout). Заголовок **`Idempotency-Key`** (опционально) — дедупликация на стороне HUB. На платформе: **`API_HUB_BRIDGE_URL`** + **`API_HUB_BRIDGE_SECRET`** (+ ретраи, см. `.env.example`).

## Production-oriented options (block 7)

- `API_HUB_AUTH_MODE=oidc` + `API_HUB_PING_OIDC_ISSUER` — real OpenID Connect (PKCE, `offline_access`, `id_token.sub` → `pingUserId`).
- `API_HUB_DB_URL` — partners, sessions (incl. encrypted PING access token), `user_links`, audit, webhook outbox; `GET /ready` checks DB.
- `API_HUB_REDIS_URL` — cross-instance realtime fanout (`docs/SCALING.md`).
- `API_HUB_PING_PLATFORM_URL` + `API_HUB_SERVICE_SECRET` (same value as on the main PING server) — after OIDC callback/refresh, HUB exchanges `id_token.sub` (platform user UUID) for a **`pm.*` bearer** via `POST /internal/api-hub/issue-user-bearer` (requires PRIME in admin). Then `GET /v1/me` proxies `GET /api/auth/me` with that token. If the secret or platform URL is unset, behaviour stays as before (stores OIDC access token only).
- When the session holds a **`pm.*`** token, **`GET /v1/chats`**, **`GET /v1/chats/:id/messages`**, **`POST …/messages:send`** proxy to the main PING `/api/chats` and `/api/chats/:id/messages` (response includes `source: ping_platform`). Otherwise the in-memory demo store is used (`source: api_hub_demo`). Reactions and `read` on the platform require **`chatId` in the JSON body** (see SDK `addReaction` / `updateStatus`).
- **`GET /v1/contacts`** with `pm.*` proxies **`GET /api/contacts?list=1`**; each entry includes **`pingUserId`** (= platform `id`) alongside `publicId`, `displayName`, etc. Demo mode still adds **`presence`** from the in-memory store only.
- **`POST /v1/contacts`** with JSON `{ "contactUserId": "<uuid>" }` proxies **`POST /api/contacts`** (scope **`chat.write`**). Without `pm.*` returns **501** (not supported in demo).
- **`POST /v1/platform/chat-media`** — загрузка фото/видео в хранилище PING для чата; затем **`url`** передавайте в **`POST …/messages:send`** как `content` с типом `image`/`video`/`video_note` на стороне платформы (через прокси сообщений).
- `API_HUB_S3_*` — presigned PUT on `upload-init`, optional public base URL or presigned GET.
- `GET /metrics`, `GET /metrics/prometheus` — request + realtime counters; webhook dead-letter counts; счётчики моста **`api_hub_bridge_*`** (запросы, 202, эмиты, 401/403/400, дубликаты `Idempotency-Key`).
- Мост **`POST /internal/platform/chat-message`**: опционально **`API_HUB_BRIDGE_ALLOWED_IPS`** (точные IP через запятую) и **`API_HUB_BRIDGE_TRUST_X_FORWARDED=1`** за одним reverse proxy; заголовок **`Idempotency-Key`** на стороне платформы включается автоматически. Дедуп: при **`API_HUB_REDIS_URL`** — **`SET NX`** с TTL 600 с (общий для всех инстансов); без Redis — in-memory на процесс. Пример алертов: **`docs/prometheus-bridge-alerts.example.yml`**.
- Контракт партнёра по WS/webhook: **`api-hub/docs/integration-example.md`**, типы **`sdk/js/src/realtime-types.ts`**, OpenAPI **`components/schemas/HubRealtimeEnvelope`** и **`PlatformBridgeBody`**.
- `api_hub_partner_api_keys` + `insertPartnerApiKey()` — API key rotation (second active key per partner).

## Notes

- Default `API_HUB_AUTH_MODE=mock` uses `src/providers/mock-ping-provider.ts` for tests and local demos.
- Chat/demo data stays in-memory; persistence is for auth/partners/webhooks/sessions when `API_HUB_DB_URL` is set.
- SQL migrations: `src/infra/db/migrations/` (run `npm run db:migrate --prefix api-hub`).
