/**
 * Реестр доменов API: путь → стабильный ключ модуля и подписи для админки.
 */

/** Стабильные ключи для группировки /api/* */
export function resolveApiModule(pathRaw: string): string {
  const path = (pathRaw.split("?")[0] || "").replace(/\/+$/, "") || "/";
  if (!path.startsWith("/api")) return "non_api";
  if (path.startsWith("/api/admin")) return "admin";
  if (path.startsWith("/api/auth")) return "auth";
  if (path.startsWith("/api/me/")) return "users";
  if (path.startsWith("/api/reports")) return "reports";
  if (path.startsWith("/api/chats/") && /\/messages(\/|$)/.test(path)) return "messages";
  if (path.startsWith("/api/chats")) return "chats";
  if (path.startsWith("/api/users")) return "users";
  if (path.startsWith("/api/posts")) return "posts";
  if (path.startsWith("/api/stories")) return "stories";
  if (path.startsWith("/api/comments")) return "comments";
  if (path.startsWith("/api/reactions")) return "reactions";
  if (path.startsWith("/api/notifications")) return "notifications";
  if (path.startsWith("/api/referrals")) return "referrals";
  if (path.startsWith("/api/calls")) return "calls";
  if (path.startsWith("/api/group-calls")) return "group_calls";
  if (path.startsWith("/api/saved")) return "saved_messages";
  if (path.startsWith("/api/tracks")) return "tracks";
  if (path.startsWith("/api/ai-chat")) return "ai_chat";
  if (path.startsWith("/api/ai-search")) return "ai_search";
  if (path.startsWith("/api/spellcheck")) return "spellcheck";
  if (path.startsWith("/api/link-preview")) return "link_preview";
  if (path.startsWith("/api/translate")) return "translate";
  if (path.startsWith("/api/vibe")) return "vibe";
  if (path.startsWith("/api/call-transcripts")) return "call_transcripts";
  if (path.startsWith("/api/contacts")) return "contacts";
  if (path.startsWith("/api/platform")) return "platform";
  if (path.startsWith("/api/board")) return "board";
  if (path === "/api/build-info" || path.startsWith("/api/time")) return "core";
  if (/\/upload\/(voice|post-media|story-media|chat-media|avatar|cover)/.test(path)) return "upload";
  if (path.includes("/upload/")) return "upload";
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return "other";
}

export const MODULE_LABELS_RU: Record<string, string> = {
  admin: "Админ-панель (API)",
  auth: "Авторизация и сессия",
  messages: "Сообщения чатов",
  chats: "Чаты",
  users: "Пользователи и профили",
  posts: "Посты и лента",
  stories: "Сториз",
  comments: "Комментарии",
  reactions: "Реакции",
  notifications: "Уведомления",
  referrals: "Рефералы",
  calls: "Звонки (сигналинг)",
  group_calls: "Групповые звонки",
  saved_messages: "Сохранённые сообщения",
  tracks: "Треки / музыка",
  ai_chat: "AI-чат",
  ai_search: "AI-поиск",
  spellcheck: "Орфография",
  link_preview: "Превью ссылок",
  translate: "Перевод в чате",
  vibe: "Vibe / настроение чата",
  call_transcripts: "Транскрипты звонков",
  contacts: "Контакты",
  reports: "Жалобы пользователей (API)",
  platform: "Платформа (публичные настройки)",
  board: "Доска",
  core: "Служебные (время, build)",
  upload: "Загрузка медиа",
  other: "Прочее API",
  non_api: "Не API",
};
