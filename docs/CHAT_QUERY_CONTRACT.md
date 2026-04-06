# React Query и чат: ключи и этапы

## Ключи

Определены в `client/src/features/chat/chat-query-keys.ts` как `chatQueryKeys`:

- `messagesTail(chatId, folderId)` — prefetch хвоста при тапе по строке в списке (`getMessages` с `MESSAGES_PAGE`).
- `messagesAll(chatId)` — инвалидация после успешной отправки сообщения (кэш догоняется при следующем prefetch / заходе).

Полная миграция `useChatMessages` на `useQuery` / `useInfiniteQuery` — отдельный этап: локальный стейт и офлайн-слой остаются источником правды до переключения.

## Prefetch

`client/src/features/chat/prefetch-chat-messages-tail.ts` вызывается из списка чатов перед навигацией.

## Инвалидация

`useSendMessage` после успешного `POST` сообщения инвалидирует `messagesAll(chatId)`.
