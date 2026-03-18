/**
 * Фича «Чат» — публичный API модуля.
 */
export type { ApiChat, ApiMessage, MessageListItem } from "./types";
export { EMOJIS, GROUP_GAP_MIN_MS, MESSAGES_PAGE, CHAT_LOAD_TIMEOUT_MS } from "./constants";
export { formatMessageTime, formatLastSeen, getDateSectionLabel, toDateKey, isUuid } from "./utils/format";
export { buildMessageListItems } from "./utils/messageListItems";
