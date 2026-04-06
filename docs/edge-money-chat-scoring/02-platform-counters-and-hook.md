# Блок 2 — Платформа: счётчики и хук сообщения

Ответственность: надёжный подсчёт «сколько пользователь написал в этом диалоге» и вызов EDGE на milestone без двойных начислений при ретраях.

---

## 2.1. Рекомендуемая папка кода

`server/edge-money-chat-messages/` — зеркало по духу `server/edge-money-invite/`: мелкие файлы, вход через `index.ts`, без логики в `routes.ts` сверх прокидывания.

Структура (черновик, уточнять при имплементации):

```text
server/edge-money-chat-messages/
  index.ts
  README.md
  types.ts
  increment-counter/increment-chat-message-counter.ts
  select-eligible-money-campaigns.ts   # или queries/*
  forward-chat-milestone-to-edge.ts
  hook-after-message-sent.ts           # тонкая обёртка для вызова из messages service
```

Каждый файл **≤250 строк**.

---

## 2.2. Таблица в основной БД платформы

Новая таблица (имя условное): `edge_money_chat_message_counters`.

Минимальные колонки:

- `user_id` — отправитель.
- `chat_id` — диалог 1:1.
- `edge_id` — `public_id` кампании MONEY (строка, как в постах).
- `sent_count` — bigint, монотонно растёт при каждом учтённом сообщении.
- `updated_at`.

Уникальный ключ `(user_id, chat_id, edge_id)`.

Индекс по `user_id` опционален для админских отчётов; для hot path достаточно PK/unique.

Миграция: `scripts/migrate-*.cjs` + запись в `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md` и `run-migrations.cjs`.

Drizzle: `shared/schema/edge-money-chat-message-counters.ts` (или сокращённое имя в стиле проекта).

---

## 2.3. Операция инкремента

В одной транзакции с записью сообщения **или** сразу после успешного `createMessage` (единая политика с остальным чатом):

1. Проверить: чат — DM, два участника-человека, отправитель = текущий user.
2. Определить список `edge_id` для начисления (см. блок 1.5).
3. Для каждого `edge_id`:  
   `INSERT ... ON CONFLICT DO UPDATE SET sent_count = edge_money_chat_message_counters.sent_count + 1 RETURNING sent_count`.

Важно: один инкремент **на одно реально сохранённое** сообщение; при повторной доставке того же события инкремент не дублировать (идемпотентность на уровне сообщения — если уже есть в проекте id сообщения, привязать optional `last_message_id` не обязательно для v1).

---

## 2.4. Условие milestone

После инкремента, если `sent_count > 0` и `sent_count % threshold === 0`:

- вычислить `blockIndex = sent_count / threshold` (целое);
- вызвать EDGE (блок 3) с параметрами, достаточными для `ref_key`.

Если вызов EDGE упал: варианты v1 — лог + метрика; v1.1 — очередь/outbox и повтор. Идемпотентность на EDGE по `ref_key` не даёт двойных баллов при повторной отправке события.

---

## 2.5. Точка входа в коде платформы

Найти **единое** место успешной отправки исходящего сообщения пользователем (например `server/messages/` или storage-слой, который уже использует `createMessage`). Подключить **тонкий** вызов `hook-after-message-sent.ts` без циклических импортов (динамический `import()` при необходимости).

Не блокировать ответ клиенту дольше, чем сейчас: при необходимости **fire-and-forget** вызов EDGE с тем же паттерном, что и для других асинхронных сайд-эффектов, сохраняя порядок «сначала счётчик в БД, потом async forward».

---

## 2.6. Производительность

- Hot path: один upsert + при milestone один HTTP к EDGE.
- Избегать `COUNT(*)` по всей таблице `messages` на каждое сообщение.
- При росте нагрузки — батчинг или отдельный воркер (вне scope v1, зафиксировать в журнале модулей при появлении).
