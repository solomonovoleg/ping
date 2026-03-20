# Сервер: модуль групповых звонков (плагин)

**По умолчанию выключен** (`GROUP_CALLS_ENABLED` не задан или `0`).

## Изоляция от тет-а-тет

- Не подключён к `server/calls/ws.ts` и `server/calls/session.ts`.
- Активные 1:1 звонки не затрагиваются деплоем этого кода, пока не смонтирован отдельный транспорт (например `attachGroupCallWebSocket` в `server/index.ts`).

## Когда подключать

1. Задать `GROUP_CALLS_ENABLED=1`.
2. Вызвать `attachGroupCallWebSocket` (или HTTP routes) из `server/index.ts` после реализации протокола.
3. При необходимости — отдельные таблицы Drizzle в `server/group-calls/db/` (позже).

Лимит файлов: **≤200 строк**.
