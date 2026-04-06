/**
 * Сборка `ChatNameResolverDeps` из минимального `Pick<IStorage, …>` (поиск сообщений, треки).
 */
import type { IStorage } from "./types";
import type { ChatNameResolverDeps } from "./db-storage-message-search-saved-queries";

export function dbStorageBuildChatNameResolverDeps(
  storage: Pick<IStorage, "getChatById" | "getChatMemberIds" | "getUser">,
): ChatNameResolverDeps {
  return {
    getChatById: (id) => storage.getChatById(id),
    getChatMemberIds: (id) => storage.getChatMemberIds(id),
    getUser: (id) => storage.getUser(id),
  };
}
