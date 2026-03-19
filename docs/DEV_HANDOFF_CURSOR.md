# DEV HANDOFF — Cursor Parallel Work

## Что это

Краткий handoff-файл для второго разработчика в Cursor: что уже сделано по архитектуре, что важно не сломать и как безопасно продолжать работу.

## Коротко: что зафиксировано как базовая архитектура

- client движется к структуре `page-shell -> feature modules -> reusable components`
- server движется к структуре `routes -> service -> repository -> serializers`
- realtime/calls централизованы через `CallContext` + `useCall` + `server/calls/ws.ts`
- архитектурные решения документируются и синхронизируются с кодом

## Текущее состояние, которое нужно сохранить

### 1) Client

- `client/src/pages/*` не должны снова превращаться в большие mixed-responsibility файлы
- доменная логика должна уходить в `client/src/features/<domain>/*`
- cross-feature runtime логика должна оставаться в `client/src/hooks/*`

### 2) Server

- `server/<domain>/routes.ts` должны быть thin route layer
- бизнес-правила выносить в `service.ts`
- data-access выносить в `repository.ts` или `server/storage/*`
- DTO mapping выносить в `serializers.ts`
- уже разнесены в этом стиле:
  - `server/ai-chat/*` (`routes + service + repository + serializers`)
  - `server/messages/*` (`routes + service`)
  - `server/saved-messages/*` (`routes + service`)
  - `server/chats/*` (`routes + service`)
  - `server/posts/*` (`routes + service`, включая feed-list, single-post и saved-posts list)
  - `server/users/*` (`routes + service`)

### 3) Realtime / calls

- сохранять единый websocket lifecycle в `client/src/hooks/useCall.ts`
- не дублировать subscribe/reconnect: subscribe-chat только при первом слушателе, unsubscribe при последнем, sendAllChatSubscriptions только в onopen
- сохранять cleanup подписок на сервере (`server/realtime/chat.ts`)

## Зоны с повышенным риском конфликтов

- `client/src/pages/ChatDetail.tsx`
- `client/src/pages/Chats.tsx`
- `client/src/hooks/useCall.ts`
- `client/src/features/chat/hooks/*`
- `server/messages/routes.ts`
- `server/chats/routes.ts`
- `server/calls/ws.ts`
- `docs/ARCHITECTURE_CURRENT.md`

## Как мерджить параллельную работу

1. Сначала прочитать:
   - `docs/ARCHITECTURE_CURRENT.md`
   - `docs/AI_HANDOFF_ARCHITECTURE.md`
2. Сопоставить свою работу с текущей структурой модулей
3. Не переносить старую структуру "как есть"
4. Встраивать поведение в текущие доменные папки и слои
5. После интеграции прогнать проверки и обновить docs

## Быстрый маршрут чтения для нового разработчика

### Client

1. `client/src/pages/Chats.tsx`
2. `client/src/pages/ChatDetail.tsx`
3. `client/src/features/chat/hooks/useChatMessages.ts`
4. `client/src/features/chat/hooks/useSendMessage.ts`
5. `client/src/features/chat/hooks/useMessageActions.ts`

### Realtime / calls

1. `client/src/contexts/CallContext.tsx`
2. `client/src/hooks/useCall.ts`
3. `server/calls/ws.ts`
4. `server/realtime/chat.ts`
5. `shared/call-signaling.ts`

### Server HTTP

1. `server/routes.ts`
2. `server/chats/routes.ts`
3. `server/messages/routes.ts`
4. `server/posts/routes.ts`
5. `server/users/routes.ts`

## Что делать дальше (приоритеты)

- продолжать точечный разнос оставшихся крупных route/page файлов
- добивать service/repository/serializer separation в доменах, где еще смешаны слои
- делать только ship-safe performance правки (без крупных рискованных переписываний)
- синхронизировать docs при каждом заметном архитектурном шаге

## Проверки перед передачей дальше

```bash
npm run check
npm run build
```

Если не удалось прогнать команды локально, передать это явно в handoff с причиной.
