# Baseline до старта рефакторинга (2026-03-25)

Снимок сделан перед началом этапного рефакторинга.

## Backup (до любых изменений)

- `backups/ping-moot-pre-refactor-20260325-161214.bundle`
- `backups/ping-moot-pre-refactor-20260325-161214.status.txt`
- `backups/ping-moot-pre-refactor-20260325-161214.workspace.tar.gz`

## Ключевая метрика размера

- Исходных файлов `>500` строк: **43** (без `node_modules`, build/derived артефактов).

## Топ крупных файлов (источники риска)

### Client
- `client/src/pages/Posts.tsx` (2555)
- `client/src/pages/ChatDetail.tsx` (2527)
- `client/src/pages/BoardEdgeNew.tsx` (2339)
- `client/src/pages/Chats.tsx` (2079)
- `client/src/features/chat/pulse-template/MobileChatDark.tsx` (1937)
- `client/src/features/group-call/ui/pulse-ai/GroupCallAILayout.tsx` (1902)
- `client/src/components/CallModal.tsx` (1870)
- `client/src/components/StoryViewer.tsx` (1559)
- `client/src/features/call/call-controller.ts` (1521)
- `client/src/pages/Settings.tsx` (1420)

### Server
- `server/storage/db-storage.ts` (2576)
- `server/storage/mem-storage.ts` (1345)
- `server/posts/service.ts` (940)
- `server/calls/ws.ts` (792)
- `server/chats/service.ts` (702)
- `server/messages/service.ts` (640)
- `server/edge/routes.ts` (630)
- `server/users/service.ts` (620)
- `server/stories/service.ts` (538)
- `server/pingok-micro/execute-service.ts` (501)

### EDGE
- `EDGE/participant/character-rules.ts` (352)
- `EDGE/participant/service.ts` (350)
- `EDGE/participant/life-simulation.ts` (312)

### api-hub
- `api-hub/src/routes/auth-routes.ts` (382)
- `api-hub/src/routes/internal-platform-bridge.ts` (309)
- `api-hub/src/store/in-memory-store.ts` (296)
- `api-hub/src/routes/chat-routes.ts` (295)
- `api-hub/src/infra/db/repository.ts` (283)

## Очередь первого прохода (низкий риск -> высокий)

1. Чистые парсеры/утилиты/типизация (без смены поведения).
2. Серверные сервисы без изменения контрактов API.
3. `server/storage/*` (разделение по зонам ответственности).
4. EDGE правила/сервисы + тесты.
5. Клиентские крупные страницы (кроме chat realtime).
6. `ChatDetail` и чатовые хуки в конце программы.

## Обязательная перепроверка после каждого шага

- `npm run check`
- `npm run build`
- профильный smoke сценарий затронутого модуля
- фиксация результата в PR-чеклисте
