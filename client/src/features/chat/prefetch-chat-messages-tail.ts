import type { QueryClient } from "@tanstack/react-query";
import { getMessages } from "@/lib/chat";
import { AI_CHAT_ID, MESSAGES_PAGE } from "@/features/chat/constants";
import { chatQueryKeys } from "@/features/chat/chat-query-keys";

/** Prefetch хвоста треда перед открытием чата (мягкий кэш, без смены экрана). */
export function prefetchChatMessagesTail(queryClient: QueryClient, chatId: string): void {
  const id = chatId.trim();
  if (!id || id === AI_CHAT_ID) return;
  void queryClient.prefetchQuery({
    queryKey: chatQueryKeys.messagesTail(id, null),
    queryFn: () => getMessages(id, { limit: MESSAGES_PAGE }),
    staleTime: 20_000,
  });
}
