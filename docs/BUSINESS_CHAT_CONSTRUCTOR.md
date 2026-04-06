# BUSINESS Chat Constructor

Модуль позволяет подключить внешний API к персональному `business`-чату пользователя в 2 шага:

1. Пользователь вводит `endpoint + api key` в `/board/business`.
2. Платформа забирает контракт API, строит команды и публикует их в интерфейсе чата.

## Компоненты

- Клиент:
  - `client/src/pages/BoardBusiness.tsx`
  - `client/src/lib/business-chat.ts`
  - `client/src/pages/ChatDetail.tsx` (кнопки команд в composer)
- Сервер:
  - `server/business-chat/routes.ts`
  - `server/business-chat/service.ts`
  - `server/business-chat/repo.ts`
  - `server/business-chat/constructor/*`
  - `server/business-chat/transport/*`
- Схема:
  - `shared/schema/business-chat.ts`
  - `migrations/0038_business_chat_constructor.sql`

## Endpoints

- `GET /api/business-chat/widgets` — список виджетов текущего пользователя.
- `POST /api/business-chat/widgets/autoconnect` — автоконфигурация виджета и создание `business`-чата.
- `GET /api/business-chat/chats/:chatId/actions` — команды для чата.
- `POST /api/business-chat/chats/:chatId/actions/:actionId/invoke` — вызов команды из кнопки.
- `POST /api/business-chat/webhook/:widgetId` — inbound webhook от внешнего сервиса.

## Формат контракта (рекомендуемый)

`/.well-known/business-chat-contract` или URL из `contractUrl`:

```json
{
  "actions": [
    {
      "id": "budget_topup",
      "label": "Пополнить бюджет",
      "kind": "form",
      "method": "POST",
      "path": "/commands/topup",
      "inputSchema": {
        "type": "object",
        "properties": {
          "amount": { "type": "number" }
        },
        "required": ["amount"]
      }
    }
  ]
}
```

Также поддерживается упрощённый OpenAPI (`openapi`, `paths`) — из него извлекаются операции.

## Inbound webhook

Поддерживаемые события:

- `message_text`
- `message_file`
- `command_set`

Пример:

```json
{
  "events": [
    { "type": "message_text", "eventId": "evt-1", "text": "Введите сумму" },
    {
      "type": "command_set",
      "eventId": "evt-2",
      "commands": [
        { "id": "budget_income", "label": "Ввести доход", "kind": "form", "method": "POST", "path": "/income" },
        { "id": "budget_expense", "label": "Ввести расход", "kind": "form", "method": "POST", "path": "/expense" }
      ]
    }
  ]
}
```

## Подпись webhook

Заголовки:

- `X-Business-Timestamp`
- `X-Business-Signature`

Подпись: `HMAC_SHA256(apiKey, "${timestamp}.${rawJsonBody}")`.

## Outbound события

Сервер отправляет POST на `endpoint_url` с body:

```json
{
  "eventType": "user_message | action_invoke",
  "idempotencyKey": "sha256(... )",
  "payload": {}
}
```

При ошибках включается retry с backoff; состояние хранится в `business_events`.
