# BUSINESS API Hub Integration

Этот файл можно отправить партнёру как техническое задание на интеграцию с мессенджером PING.

## 1) Назначение интеграции

Партнёрский сервис (например, бухгалтерия/биллинг) подключается к `business`-чату в PING и:

- принимает события из PING (сообщения, нажатия кнопок),
- отправляет ответы и наборы кнопок обратно в PING через webhook,
- использует подпись запросов для безопасности,
- хранит привязку пользователя PING к своему аккаунту.

## 2) Что партнёр должен настроить

1. Endpoint для приёма событий из PING (`endpointUrl`).
2. Общий секрет `apiKey` (для `Authorization` и HMAC подписи).
3. Обработчик webhook в PING: `POST /api/business-chat/webhook/:widgetId`.
4. Хранение маппинга `PING senderId -> partnerAccountId`.
5. Идемпотентность по `idempotencyKey`.

## 3) Outbound: события, которые PING шлёт партнёру

PING отправляет `POST` на `endpointUrl`.

### Заголовки

- `Content-Type: application/json`
- `X-Business-Timestamp: <unix_seconds>`
- `X-Business-Signature: <hex_hmac_sha256>`
- `Authorization: Bearer <apiKey>` (если apiKey непустой)

### Формат body

```json
{
  "eventType": "user_message | action_invoke",
  "idempotencyKey": "sha256(...)",
  "payload": {}
}
```

### `eventType = "user_message"` payload

```json
{
  "chatId": "uuid",
  "senderId": "uuid",
  "messageId": "uuid",
  "type": "text|file|...",
  "content": "строка",
  "createdAt": "2026-03-31T12:34:56.000Z"
}
```

### `eventType = "action_invoke"` payload

```json
{
  "chatId": "uuid",
  "actionId": "budget_topup",
  "label": "Пополнить бюджет",
  "input": {
    "amount": 15000
  },
  "transport": {
    "method": "POST",
    "path": "/commands/topup",
    "payloadTemplate": null
  }
}
```

## 4) Inbound: что партнёр шлёт в PING

`POST /api/business-chat/webhook/:widgetId`

### Заголовки (обязательно)

- `X-Business-Timestamp`
- `X-Business-Signature`

### Поддерживаемые события

- `message_text`
- `message_file`
- `command_set`

### Пример body

```json
{
  "events": [
    {
      "type": "message_text",
      "eventId": "evt-1",
      "text": "Выберите действие"
    },
    {
      "type": "command_set",
      "eventId": "evt-2",
      "commands": [
        {
          "id": "invoice_get",
          "label": "Получить счет",
          "kind": "button",
          "method": "POST",
          "path": "/invoice/get"
        },
        {
          "id": "budget_topup",
          "label": "Запросить пополнение",
          "kind": "form",
          "method": "POST",
          "path": "/budget/topup",
          "inputSchema": {
            "type": "object",
            "properties": {
              "amount": { "type": "number" }
            },
            "required": ["amount"]
          }
        },
        {
          "id": "budget_expense_set",
          "label": "Указать расход",
          "kind": "form",
          "method": "POST",
          "path": "/budget/expense/set"
        },
        {
          "id": "budget_balance",
          "label": "Проверить остаток",
          "kind": "button",
          "method": "GET",
          "path": "/budget/balance"
        },
        {
          "id": "budget_daily_limit",
          "label": "Изменить дневной расход",
          "kind": "form",
          "method": "POST",
          "path": "/budget/daily-limit"
        },
        {
          "id": "pp_attach",
          "label": "Прикрепить ПП",
          "kind": "file_upload",
          "method": "POST",
          "path": "/docs/pp/upload"
        },
        {
          "id": "promo_check",
          "label": "Проверить промокод",
          "kind": "form",
          "method": "POST",
          "path": "/promo/check"
        },
        {
          "id": "promo_list",
          "label": "Список промокодов",
          "kind": "button",
          "method": "GET",
          "path": "/promo/list"
        }
      ]
    }
  ]
}
```

## 5) Формат кнопок (команд)

```json
{
  "id": "string",
  "label": "string",
  "kind": "button | form | file_upload",
  "method": "GET | POST | PUT | PATCH | DELETE",
  "path": "/relative/path",
  "inputSchema": {},
  "payload": {}
}
```

### Смысл `kind`

- `button`: действие без формы.
- `form`: действие с полями (`inputSchema`).
- `file_upload`: действие с загрузкой файла и подтверждением.

## 6) Идентификаторы

- `chatId` — идентификатор бизнес-чата в PING.
- `senderId` — идентификатор пользователя PING.
- `messageId` — идентификатор сообщения.
- `actionId` — идентификатор команды/кнопки.

Важно: в BUSINESS-интеграции отдельный `channelId` не используется, роль канала выполняет `chatId`.

## 7) Подпись запросов (обе стороны)

Формула:

```text
signature = HMAC_SHA256(secret, `${timestamp}.${rawJsonBody}`)
```

Где:

- `secret` = `apiKey`,
- `timestamp` = `X-Business-Timestamp` (unix seconds),
- `rawJsonBody` = JSON body в строковом виде.

### Пример (Node.js)

```js
import crypto from "crypto";

function sign(payloadJson, timestampSec, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestampSec}.${payloadJson}`)
    .digest("hex");
}
```

## 8) Рекомендации по надёжности

- На стороне партнёра хранить `idempotencyKey` и не обрабатывать дубль повторно.
- Проверять подпись и свежесть `timestamp` (окно 300 секунд).
- На любой успешный приём отвечать `2xx`.
- При внутренних ошибках возвращать `5xx` (PING повторит доставку по retry/backoff).

## 9) SSO "Войти через PING" для CRM (точный контракт)

Ниже зафиксирован поддерживаемый в проекте поток через API HUB.

### 9.1 Старт авторизации

- Endpoint старта:
  - `GET https://<hub-host>/v1/auth/ping/start?externalUserId=<crmUserId>&loginCallbackUrl=https://<crm-host>/api/auth/ping/login&redirectUrl=https://<crm-host>/auth`
- Обязательный заголовок: `x-partner-api-key: <partnerApiKey>`
- Ответ:
  - `mode` (`mock` или `oidc`)
  - `authUrl` (куда редиректить браузер пользователя)
  - `state` (для `oidc`, обязателен в callback, TTL состояния: 10 минут)

### 9.2 Как пользователь возвращается после входа в PING

- В OIDC-режиме PING IdP делает browser redirect на `API_HUB_OAUTH_REDIRECT_URI`, обычно:
  - `GET https://<hub-host>/v1/auth/ping/callback?code=<code>&state=<state>`
- После успешного callback HUB выполняет server-to-server `POST` в CRM (`loginCallbackUrl`) и только после успешного ответа редиректит браузер на `redirectUrl`.
- Если `redirectUrl` не передан, callback возвращает JSON с токенами (`accessToken`, `refreshToken`, `scope`, `user`) как в стандартном API HUB потоке.

### 9.3 Как получить стабильный `senderId`

Рекомендуемый способ:

1. Завершить callback через HUB.
2. Взять `pingUserId` из ответа (`user`/профиль) или из `GET /v1/me`.
3. Хранить его как ваш SSO-идентификатор.

`pingUserId` является стабильным id пользователя PING и должен использоваться как `senderId` для связки с BUSINESS webhook (`payload.senderId`).

### 9.4 Безопасность подписи (HMAC)

Формула подписи:

`signature = HMAC_SHA256(apiKey, "${timestamp}.${rawJsonBody}")`

Заголовки:

- `X-Business-Timestamp: <unix_seconds>`
- `X-Business-Signature: <hex_hmac_sha256>`

Правила:

- Подписывается ровно JSON-строка, отправляемая в HTTP body (без pretty-print).
- Рекомендуемое окно валидности timestamp: `300` секунд.

### 9.5 Callback `POST /api/auth/ping/login` (реализовано)

HUB отправляет:

- `POST https://<crm-host>/api/auth/ping/login`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <apiKey>`
  - `X-Business-Timestamp: <unix_seconds>`
  - `X-Business-Signature: <hex_hmac_sha256>`
- Body:

```json
{
  "senderId": "<pingUserId>",
  "idempotencyKey": "<uuid>"
}
```

Поведение доставки:

- на `2xx` callback считается успешным;
- на `4xx` callback считается отклонённым (без ретрая; для `403` возвращается отказ SSO);
- на `5xx` HUB делает retry с backoff (несколько попыток в рамках callback) и при неуспехе завершает flow ошибкой;
- timeout запроса HUB -> CRM: 12 секунд на попытку.

### 9.6 CORS и источник запроса

- `POST /api/auth/ping/login` выполняется с backend API HUB (server-to-server), не из браузера.
- CORS для этого запроса не требуется.
- Cookie/SameSite для этого шага не требуются (если CRM не вводит собственную cookie-схему на своей стороне).

### 9.7 Ошибки/статусы

- `403` для кейса "senderId не привязан в CRM" — корректный и ожидаемый статус (SSO запрещён до первичной привязки).
- `4xx` (кроме технических 5xx) — без ретраев, flow завершается ошибкой бизнес-валидации.
- `5xx` — HUB делает retry/backoff и, если CRM остаётся недоступным, возвращает ошибку интеграции.
- При наличии `redirectUrl` ошибка callback приводит к browser redirect:
  - `https://<crm-host>/auth?pingSso=error&code=<error_code>`

### 9.8 Первичная привязка

Первичная привязка `senderId` к CRM-аккаунту выполняется в кабинете партнёра вашим отдельным endpoint (например, `POST /api/business-hub/ping/bind`), после чего SSO может быть разрешён.

## 10) Готовый список бизнес-кнопок под ваш сценарий

Минимальный набор команд:

- `invoice_get` — получить счет на услугу.
- `budget_topup` — запросить пополнение бюджета.
- `budget_expense_set` — указать расход/бюджет.
- `budget_balance` — проверить остаток.
- `budget_daily_limit` — изменить дневной расход.
- `pp_attach` — прикрепить ПП.
- `promo_check` — проверить промокод.
- `promo_list` — получить список всех промокодов.

Рекомендуется отдавать их через событие `command_set`, чтобы кнопки обновлялись динамически.
