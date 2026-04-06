/**
 * Доставка и прочтение сообщений: общий контракт клиент ↔ сервер.
 *
 * **Клиент (исходящие, оптимистичная отправка)** — {@link CLIENT_OUTGOING_SEND_STATUS}:
 * пока сообщение не подтверждено API, UI держит sending/sent/failed.
 *
 * **Сервер (источник правды после приёма)** — сообщение в `messages` с `id` и `created_at`;
 * «прочитано ли собеседником мои сообщения» — не поле сообщения, а `chat_members.last_read_at`
 * у другого участника (в API как `otherMember.lastReadAt` в DM). Событие `chat-read` по WebSocket
 * обновляет курсор; `mark-chat-read` принимается только при `subscribe-chat-thread` (открыт экран диалога),
 * не при одной лишь подписке списка чатов (`subscribe-chat`).
 */
export const CLIENT_OUTGOING_SEND_STATUS = ["sending", "sent", "failed"] as const;

export type ClientOutgoingSendStatus = (typeof CLIENT_OUTGOING_SEND_STATUS)[number];
