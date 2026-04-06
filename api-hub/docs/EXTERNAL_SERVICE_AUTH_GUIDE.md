# Внешние сервисы: вход и аккаунты через PING (API HUB)

Документ для команд, которые встраивают **«Войти через PING»** и работу с данными пользователя PING (профиль, чаты, контакты и т.д.) **без собственной копии пароля PING**.

---

## 1. Модель в двух фразах

- **PING** — источник правды об аккаунте: регистрация, пароль, 2FA, блокировки живут на стороне PING.
- **API HUB** — посредник OAuth/OIDC: выдаёт вашему сервису **сессионный access token** (JWT HUB) и при необходимости обменивает доступ на **токен платформы PING (`pm.*`)** для прокси к `/api/*`.

Ваш сервис **не реализует проверку пароля PING**. Он реализует только:

1. вызов API HUB с **ключом партнёра**;
2. перенаправление пользователя на страницу входа PING (в режиме OIDC) или использование тестового потока (mock);
3. хранение у себя **accessToken / refreshToken**, которые вернул HUB.

---

## 2. Что нужно получить от оператора PING

| Сущность | Назначение |
|----------|------------|
| **URL API HUB** | База вида `https://api-hub.example.com` |
| **Partner API Key** | Секрет для заголовка `x-partner-api-key` на всех запросах к HUB (кроме внутренних мостов платформы) |
| **Режим авторизации** | `mock` (разработка) или `oidc` (прод) на стороне HUB |
| **PRIME для пользователей** | Если нужны реальные чаты/контакты с платформы: в админке PING пользователю задаётся **PRIME CODE** (`board_api_hub_prime_code`). Без этого внутренний обмен на `pm.*` вернёт **403**. |
| **OIDC (для прода)** | Issuer PING (`API_HUB_PING_OIDC_ISSUER`), `client_id` / `client_secret`, зарегистрированный **redirect URI** = `API_HUB_OAUTH_REDIRECT_URI` на HUB (точное значение выдаёт оператор) |
| **Секреты платформа↔HUB** | `API_HUB_SERVICE_SECRET` одинаковый на PING и HUB; для моста realtime — `API_HUB_BRIDGE_*` (см. `integration-example.md`) |

Подробности по env — в **`api-hub/README.md`** и **`.env.example`**.

---

## 3. Регистрация пользователя: что делает ваш сервис

**Регистрация нового аккаунта PING** через ваш сайт возможна только если вы:

- ведёте пользователя в **официальный флоу регистрации PING** (приложение / сайт PING), **или**
- используете отдельный контракт с PING (например, deep link на регистрацию).

API HUB **не** предоставляет публичного API «создать пользователя PING с паролём» для сторонних сайтов. Ваш модуль должен трактовать сценарий так:

1. Пользователь **уже есть в PING** → «Войти через PING» → OAuth → вы получаете токены HUB.
2. Пользователя **ещё нет** → CTA «Создать аккаунт в PING» → после регистрации пользователь возвращается и нажимает «Войти через PING».

Связка «пользователь на вашем сайте ↔ пользователь PING» опционально задаётся параметром **`externalUserId`** на старте OAuth (см. ниже): HUB сохраняет связку `partnerId + externalUserId → pingUserId` (user link).

---

## 4. Заголовки и токены

Все запросы партнёра к HUB (кроме описанных исключений в OpenAPI):

```http
x-partner-api-key: <ваш ключ>
Content-Type: application/json
```

После успешного логина:

```http
Authorization: Bearer <accessToken от HUB>
```

**Access token** — JWT сессии HUB (короткоживущий). **Refresh** — от OIDC PING (в режиме OIDC) или mock; его нужно хранить **зашифрованным** у себя и передавать в `POST /v1/auth/refresh` по документации HUB.

---

## 5. Поток авторизации (mock — разработка)

Режим **`API_HUB_AUTH_MODE=mock`** на HUB. Удобен для локальной разработки модуля без реального IdP.

### Шаг 1. Старт

```http
GET /v1/auth/ping/start?externalUserId=site_user_42&loginCallbackUrl=https://crm.example.com/api/auth/ping/login&redirectUrl=https://crm.example.com/auth
x-partner-api-key: <ключ>
```

Ответ содержит **`code`** и часто готовый **`authUrl`** (с уже подставленным `code`). В mock **код можно обменять с сервера** без редиректа браузера на PING.

Параметры query (часто используемые):

| Параметр | Описание |
|----------|----------|
| `externalUserId` | Ваш внутренний ID пользователя — сохранится связка с `pingUserId` |
| `pingUserId` | Только mock: какой демо-пользователь PING эмулировать |
| `loginCallbackUrl` | Опционально: server-to-server callback URL для `POST { senderId }` после успешного логина |
| `redirectUrl` | Опционально: куда HUB редиректит браузер после успешного callback в CRM |
| `scopes` | Список scope (если поддерживается вашей версией HUB) |

### Шаг 2. Обмен code на токены

```http
GET /v1/auth/ping/callback?code=<code>
x-partner-api-key: <ключ>
```

Ответ (упрощённо): `accessToken`, `refreshToken`, `user`, `scope`.

### Шаг 3. Дальнейшие вызовы

Подставляйте `Authorization: Bearer <accessToken>` и тот же `x-partner-api-key`.

**Пример на TypeScript** (как в `docs/integration-example.md`):

```ts
const hub = new ApiHubClient({ baseUrl, partnerApiKey });
const start = await hub.startOAuth({ externalUserId: "site_user_42" });
const session = await hub.completeOAuth(start.code);
hub.setAccessToken(session.accessToken);
```

> В SDK метод `completeOAuth(code)` для **OIDC** должен передавать ещё и **`state`** в query (см. §6); для mock достаточно `code`.

---

## 6. Поток авторизации (OIDC — продакшен)

Режим **`API_HUB_AUTH_MODE=oidc`**. HUB строит URL авторизации PING с **PKCE** и ожидает от IdP:

- `offline_access` → **refresh_token**;
- **id_token** с **`sub`** = идентификатор пользователя (для обмена на `pm.*` на платформе **`sub` должен быть UUID** пользователя в БД PING).

### Шаг 1. Старт (сервер вашего сервиса)

```http
GET /v1/auth/ping/start?externalUserId=...&loginCallbackUrl=...&redirectUrl=...
x-partner-api-key: <ключ>
```

Ответ: `authUrl`, `state`, `mode: "oidc"`.

### Шаг 2. Браузер пользователя

Откройте **`authUrl`** (полный редирект или новое окно / Custom Tabs). Пользователь входит в **аккаунт PING**.

### Шаг 3. Callback

IdP перенаправляет на **`API_HUB_OAUTH_REDIRECT_URI`**, обычно:

`GET https://<hub>/v1/auth/ping/callback?code=...&state=...`

Если в `/v1/auth/ping/start` передан `loginCallbackUrl`, HUB после успешного обмена кода отправит:

- `POST <loginCallbackUrl>`
- body: `{ "senderId": "<pingUserId>", "idempotencyKey": "<uuid>" }`
- headers: `Authorization: Bearer <apiKey>`, `X-Business-Timestamp`, `X-Business-Signature` (`HMAC_SHA256(apiKey, "${timestamp}.${rawJsonBody}")`)

На `2xx` callback считается успешным. На `4xx` flow отклоняется без ретраев. На `5xx` HUB делает retry/backoff и при неуспехе возвращает ошибку. Таймаут запроса HUB -> CRM: 12 секунд на попытку.

Если дополнительно передан `redirectUrl`, браузер после успешного callback в CRM получает `302` на этот URL (с query `pingSso=ok`).
При ошибке callback и наличии `redirectUrl` браузер получает `302` на `redirectUrl` с query `pingSso=error&code=<error_code>`.

Маршрут защищён **`partnerAuth`**: нужен заголовок **`x-partner-api-key`**.

**Важно (интеграция в веб):** обычный редирект браузера **не присылает** произвольные заголовки. Варианты согласовать с оператором PING/HUB:

1. **Прокси (nginx и т.п.)** перед HUB, который для данного пути добавляет `x-partner-api-key` (ограничить доступ по сети, не светить ключ в фронте).
2. **Отдельный BFF-эндпоинт** на вашем домене, который принимает редирект от IdP не напрямую на HUB, а на себя — если в будущем PING зарегистрирует `redirect_uri` на ваш домен; тогда потребуется согласованный с командой PING обмен `code`/`state` с HUB (сейчас PKCE verifier хранится на HUB, поэтому `redirect_uri` в клиенте OIDC должен указывать на **тот URL, где HUB завершит обмен** — см. настройки оператора).
3. **Нативное приложение**: финальный URL перехватывается приложением, затем **нативный код** вызывает HUB callback с заголовком (не через системный браузер без контроля заголовков).

Для **сервер-сервер** тестов OIDC можно вызвать callback через `curl`/SDK с обоими query-параметрами и заголовком ключа.

---

## 7. Обновление и выход

- **`POST /v1/auth/refresh`** — тело с `refreshToken` (если не используете cookie-схему HUB); заголовки: ключ партнёра + при необходимости старый access.
- **`POST /v1/auth/logout`** — инвалидация сессии на стороне HUB; храните у себя политику «разлогин только у нас / ещё и у PING».

Детали полей — в **OpenAPI** (`/openapi.yaml` на инстансе HUB).

---

## 8. Доступ к данным PING (`pm.*`)

Когда на HUB заданы **`API_HUB_PING_PLATFORM_URL`** и **`API_HUB_SERVICE_SECRET`**, после успешного OIDC HUB может запросить у платформы **`POST /internal/api-hub/issue-user-bearer`** и сохранить **Bearer `pm.*`** в сессии.

Тогда вызовы вида **`GET /v1/me`**, **`GET /v1/chats`**, отправка сообщений и т.д. **проксируются** на основной API PING.

Условия на стороне PING:

- пользователь существует и не заблокирован;
- у пользователя **назначен PRIME CODE** для API HUB (иначе **403** на выдачу `pm.*`).

Если обмен не настроен, HUB работает в демо-режиме с in-memory данными (не ваши реальные чаты).

---

## 9. Минимальный чеклист модуля на вашей стороне

1. **Хранилище секретов**: partner API key только на бэкенде.
2. **Таблица сессий**: у вас `userId` (свой) ↔ `accessToken`, `refreshToken`, `expiresAt`, опционально `pingUserId` из ответа HUB/`/v1/me`.
3. **Эндпоинт «Начать вход»**: бэкенд вызывает `/v1/auth/ping/start`, отдаёт клиенту `authUrl` (OIDC) или выполняет цепочку mock.
4. **Эндпоинт «Завершить вход»** или обработка callback: обмен `code` (+ `state` для OIDC) на токены через HUB.
5. **Обновление токена** до истечения access (cron/прослойка при 401).
6. **Realtime / вебхуки** (опционально): см. `docs/integration-example.md` и типы `sdk/js/src/realtime-types.ts`.

---

## 10. Документы и артефакты в репозитории

| Файл | Содержание |
|------|------------|
| `api-hub/openapi/api-hub.v1.yaml` | Контракт REST |
| `api-hub/sdk/js/src/index.ts` | Пример клиента |
| `api-hub/docs/integration-example.md` | OAuth-каркас, WS, прод моста |
| `api-hub/docs/pilot-checklist.md` | Чеклист пилота |
| `docs/PROJECT_MAP.md` | Карта модулей проекта |

---

## 11. Поддержка

Схема OIDC (issuer, redirect URI, scopes), выдача ключей партнёра и PRIME — через **оператора платформы PING**. Технические ошибки обмена токенов смотрите в логах HUB и ответах JSON (`error`, `message`).
