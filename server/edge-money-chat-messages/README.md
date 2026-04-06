# EDGE MONEY — начисление за сообщения в ЛС

- Хук: `handleUserChatMessageForEdgeMoney` вызывается из `server/messages/service.ts` после сохранения исходящего сообщения.
- Учитываются только **ЛС на двоих**, не **service-chat** (`service_chat_threads`).
- Счётчики: таблица `edge_money_chat_message_counters` (уникально `user_id + chat_id + edge_id`).
- Список кампаний: `GET /v1/money/chat-accrual-targets` (EDGE, сервисный секрет), кеш на платформе ~45 с.
- Milestone: `POST /v1/money/platform-events` с `type: chat_messages_milestone`.

Подробнее: `docs/edge-money-chat-scoring/`.
