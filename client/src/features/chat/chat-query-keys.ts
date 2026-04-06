/**
 * Контракт ключей React Query для чата: prefetch / invalidate без «магических» массивов.
 * См. `docs/CHAT_QUERY_CONTRACT.md`.
 */
export const chatQueryKeys = {
  all: ["chats"] as const,
  detail: (chatId: string) => [...chatQueryKeys.all, "detail", chatId] as const,
  folders: (chatId: string) => [...chatQueryKeys.all, chatId, "folders"] as const,
  /** Хвост треда для prefetch при входе (folderId `null` — основная вкладка). */
  messagesTail: (chatId: string, folderId: string | null) =>
    [...chatQueryKeys.all, chatId, "messages", "tail", folderId ?? "main"] as const,
  /** Префикс для инвалидации всех кэшей сообщений чата. */
  messagesAll: (chatId: string) => [...chatQueryKeys.all, chatId, "messages"] as const,
} as const;
