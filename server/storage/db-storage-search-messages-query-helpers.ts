import { escapeSqlLikeUserSearch } from "./db-storage-user-like-escape";

export const SEARCH_MESSAGES_MAX_LIMIT = 50;

export function clampSearchMessagesLimit(limit: number): number {
  return Math.min(limit, SEARCH_MESSAGES_MAX_LIMIT);
}

/** Паттерн ILIKE по содержимому сообщения: `%`/`_` в запросе не становятся масками SQL. */
export function buildMessageContentSearchIlikePattern(trimmedQuery: string): string {
  return `%${escapeSqlLikeUserSearch(trimmedQuery)}%`;
}
