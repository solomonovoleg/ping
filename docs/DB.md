# База данных — архитектура

## Схема (PostgreSQL + Drizzle)

- **users** — `id`, **public_id** (целое, с 100, +1 на пользователя), `phone`, `password`, `display_name`, `surname`, `avatar_url`.
- **chats** — чаты: `id`, `type` (dm | group), `name`, `createdAt`. У каждого пользователя — свой список чатов (через `chat_members`); чат создаётся, когда пользователь находит другого в поиске и инициирует диалог (`POST /api/chats/start-dm`).
- **chat_members** — участники чата: `chatId`, `userId`, `role`, `joinedAt`, **lastReadAt** (дата последнего прочтения для счётчика непрочитанных).
- **messages** — сообщения: `id`, `chatId`, `senderId`, `type` (text | system), `content`, `createdAt`.
- **contacts** — контакты пользователя (зарезервировано под будущее).

Статус прочтения: для каждого участника хранится `lastReadAt`. Непрочитанные = сообщения в чате с `createdAt > lastReadAt` для этого пользователя.

## Слой доступа

- **IStorage** — общий интерфейс (users, chats, messages, lastRead, unreadCount).
- **MemStorage** — in-memory (без `DATABASE_URL`), для разработки.
- **DbStorage** — PostgreSQL через Drizzle (при наличии `DATABASE_URL`).

В `server/storage/index.ts` автоматически выбирается реализация: если задан `DATABASE_URL`, используется БД, иначе — память.

## Подключение

1. Задать `DATABASE_URL` (PostgreSQL).
2. Применить схему: `npm run db:push` (Drizzle) или свои миграции.
3. Запуск приложения: при наличии `DATABASE_URL` все данные сохраняются в БД.

## API, связанные с прочтением

- `PUT /api/chats/:id/read` — отметить чат как прочитанный (обновляет `lastReadAt` для текущего пользователя).
- Счётчик непрочитанных можно считать на клиенте по данным чата/сообщений или добавить отдельный эндпоинт/поле в ответ списка чатов.

## Локализация и быстрый поиск

- **Локаль БД**: при создании БД можно задать локаль для сортировки/поиска (например `ru_RU.UTF-8`):  
  `CREATE DATABASE ping_moot LC_COLLATE='ru_RU.UTF-8' LC_CTYPE='ru_RU.UTF-8' TEMPLATE=template0;`
- **Поиск**: уникальные поля (`phone`, `public_id`) уже индексируются. Для поиска по сообщениям/чатам при необходимости добавь отдельные индексы (например GIN по `content` или индекс по `chat_id`, `created_at`).
