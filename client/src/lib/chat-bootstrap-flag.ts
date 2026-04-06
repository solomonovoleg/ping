/**
 * Агрегированный `GET /api/chats/:id/bootstrap` (чат + папки + хвост сообщений) — контракт внедряется отдельно.
 * Пока `false`: клиент использует существующие параллельные запросы.
 */
export const CHAT_BOOTSTRAP_API_ENABLED = import.meta.env.VITE_CHAT_BOOTSTRAP === "1";
