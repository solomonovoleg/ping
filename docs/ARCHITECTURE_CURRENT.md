# PING MOOT — текущая архитектура

## Цель

Этот документ фиксирует актуальное устройство проекта: как разделены client/server/shared, где живет логика, как идут данные, и куда добавлять новый код без возврата к god-files.

## Верхний уровень

```text
client/   -> React UI, страницы, feature-модули, hooks, API adapters
server/   -> Express API, websocket/calls, upload, storage, db bootstrap
shared/   -> schema, общие контракты, типы и константы client/server
docs/     -> архитектурные и продуктовые документы, handoff и правила
```

## Навигация по папкам

### 1) С чего начать знакомство с проектом

Открывай в таком порядке:

1. `client`
2. `server`
3. `shared`
4. `docs`

### 2) Где смотреть экранный UI

1. `client/src/pages`
2. `client/src/features`
3. `client/src/components`

Правило: `pages` должны быть page-shell уровнем и оркестрировать данные/сценарии, а не содержать весь runtime внутри себя.

### 3) Где смотреть клиентскую механику без UI

1. `client/src/contexts`
2. `client/src/hooks`
3. `client/src/lib`

Ключевые точки:

- `client/src/contexts/CallContext.tsx` — единый call/realtime instance в приложении
- `client/src/hooks/useCall.ts` — websocket lifecycle `/calls`, signaling, chat realtime fanout
- `client/src/lib/*` — API adapters, утилиты, нормализация

### 4) Где смотреть backend HTTP

1. `server/routes.ts` (центральная регистрация доменов)
2. `server/<domain>/routes.ts` (точка входа домена)
3. рядом `service.ts` / `repository.ts` / `serializers.ts` (если есть)
4. `server/storage/*` и `server/db/*` для data-access/подключения

### 5) Где смотреть realtime и звонки

1. `shared/call-signaling.ts`
2. `client/src/contexts/CallContext.tsx`
3. `client/src/hooks/useCall.ts`
4. `server/calls/ws.ts`
5. `server/realtime/chat.ts`
6. `server/calls/state.ts`

### 6) Где смотреть данные и схемы

1. `shared/schema/*`
2. `shared/schema/index.ts`
3. `server/db/*`
4. `server/storage/*`
5. доменный `server/<domain>/repository.ts` (если есть)

## Слои и ответственность

## Client

- `client/src/pages/*` — входы в экраны, параметры роутинга, связка feature-блоков
- `client/src/features/*` — доменные hooks/components/utils конкретного сценария
- `client/src/components/*` — переиспользуемый UI
- `client/src/hooks/*` — cross-feature runtime hooks
- `client/src/lib/*` — transport/helpers, без тяжелого UI-state
- `client/src/contexts/*` — глобальные runtime contexts

## Server

- `server/index.ts` — bootstrap express/http server
- `server/routes.ts` — регистрация всех доменных маршрутов и ws attach
- `server/*/routes.ts` — thin HTTP layer (валидация, вызов доменной логики, response)
- `server/*/service.ts` — бизнес-правила и orchestration
- `server/*/repository.ts` — data-access/query слой домена
- `server/*/serializers.ts` — DTO/response mapping
- `server/storage/*` — shared data-access helpers
- `server/realtime/*`, `server/calls/*` — websocket/fanout/signaling/call state

## Shared

- `shared/schema/*` — drizzle schema, insert schemas, базовые типы данных
- `shared/call-signaling.ts` — signaling contract для client/server
- `shared/social/*` — социальные общие константы

Правило: в `shared` только контракты и схемы. Runtime-логика приложения не переносится в `shared`.

## Основные потоки

### 1. HTTP поток

1. UI вызывает функцию из `client/src/lib/*`
2. Клиент идет в `server/<domain>/routes.ts`
3. Route вызывает service/repository/storage
4. Сервер возвращает DTO
5. Клиент обновляет Query cache и рендер

### 2. Сообщения и chat realtime

1. `useCall` держит websocket `/calls`
2. Экран чата подписывается через `subscribeChat(chatId, cb)`
3. Сервер хранит подписки в `server/realtime/chat.ts`
4. При событиях сервер шлет `chat-message`, `typing`, `voice-recording`, `chat-list-update`
5. Клиент делает локальный fanout и точечные invalidate

### 3. Звонки

1. Клиент получает token через `/api/calls/token`
2. Открывает websocket `/calls?token=...`
3. Signaling: `call-initiate` -> `offer/answer` -> `ice-candidate`
4. WebRTC media живет в `simple-peer`
5. Завершение синхронизируется `call-end`

## Практические правила для архитектуры

- не смешивать page UI, transport, business logic в одном файле
- если файл снова становится god-file, резать по ответственности
- routes держать тонкими, переносить правила в service/repository
- realtime-события делать узкими и дешевыми (локальный fanout + точечный invalidate)
- новые фичи сначала встраивать в текущую структуру, не приносить старую структуру "как есть"

## Куда добавлять новый код

### UI

- новый экран: `client/src/pages/*`
- экранный сценарий: `client/src/features/<domain>/*`
- общий компонент: `client/src/components/*` или `client/src/components/ui/*`
- API adapter/helper: `client/src/lib/*`

### Server

- HTTP вход: `server/<domain>/routes.ts`
- orchestration: `server/<domain>/service.ts`
- data-access: `server/<domain>/repository.ts` или `server/storage/*`
- DTO mapping: `server/<domain>/serializers.ts`

### Shared

- добавлять только действительно общий контракт между client и server

## Документация и ведение папок

- любой заметный рефактор структуры обновляет этот файл в том же PR
- handoff для другого разработчика синхронизируется в `docs/DEV_HANDOFF_CURSOR.md`
- handoff для ИИ-агента синхронизируется в `docs/AI_HANDOFF_ARCHITECTURE.md`
- при появлении нового доменного слоя (service/repository/serializer) это должно быть отражено в документации
- новые папки именуются по домену и ответственности, а не по технической детали

## Чек перед merge

1. `npm run check`
2. `npm run build`
3. Проверить, что docs отражают реальные пути/файлы
4. Проверить, что routes/page файлы не выросли обратно в mixed-responsibility layer

## Недавнее приведение к структуре

- `server/ai-chat/routes.ts` теперь thin route layer
- `server/ai-chat/service.ts` содержит orchestration и AI-поведение
- `server/ai-chat/repository.ts` содержит SQL/data-access
- `server/ai-chat/serializers.ts` содержит mapping в DTO
- `server/saved-messages/routes.ts` оставлен как thin route layer, сценарии вынесены в `server/saved-messages/service.ts`
- `server/messages/routes.ts` переведен в thin route слой, сценарии list/send/edit/delete вынесены в `server/messages/service.ts`
- `server/chats/routes.ts` переведен в thin route слой, orchestration вынесена в `server/chats/service.ts`
- `server/posts/routes.ts` переведен в thin route слой: create/update/delete/share/save/view, single-post, saved-posts list и feed-list orchestration вынесены в `server/posts/service.ts`
- `server/users/routes.ts` переведен в thin route слой, доменные сценарии профиля/подписок/блоков/контактов вынесены в `server/users/service.ts`
- `server/stories/routes.ts` переведен в thin route слой, вся логика (list/create/view/viewers/feed/delete) вынесена в `server/stories/service.ts`; `users/service.ts` импортирует `getStoriesByAuthorId` из `stories/service`, а не из routes
- `server/tracks/routes.ts` — thin route слой для виджета «Треки» в Борде: создание треков, добавление сообщений из чатов, отметка «выполнено»
