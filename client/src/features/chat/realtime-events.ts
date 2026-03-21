export type ChatReadEventDetail = {
  chatId: string;
  readerId?: string;
  lastReadAt?: string;
};

export type MessageReactionEventDetail = {
  chatId: string;
  messageId: string;
  reactions: { emoji: string; count: number }[];
  userId: string;
  emoji: string | null;
};

export type MessageEditedEventDetail = {
  chatId: string;
  messageId: string;
  content: string;
};

export type ChatVibeUpdateDetail = {
  chatId: string;
  theme: string;
  confidence: number;
  tokens: Record<string, string | number>;
  visualIntensity: number;
};

const EVT_CHAT_LIST_UPDATE = "ping:chat-list-update";
const EVT_INCOMING_CHAT_MESSAGE_HINT = "ping:incoming-chat-message-hint";
const EVT_CHAT_READ = "ping:chat-read";
const EVT_MESSAGE_REACTION = "ping:message-reaction";
const EVT_MESSAGE_EDITED = "ping:message-edited";
const EVT_CHAT_VIBE_UPDATE = "ping:chat-vibe-update";

function emit<T>(name: string, detail?: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, detail == null ? undefined : { detail }));
}

function on<T>(name: string, handler: (detail: T) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = (e: Event) => {
    const detail = (e as CustomEvent<T>).detail;
    handler(detail);
  };
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}

export function emitChatListUpdate(): void {
  emit(EVT_CHAT_LIST_UPDATE);
}

export function onChatListUpdate(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVT_CHAT_LIST_UPDATE, handler);
  return () => window.removeEventListener(EVT_CHAT_LIST_UPDATE, handler);
}

export type IncomingChatMessageHintDetail = { chatId: string; senderId: string };

/** Сервер прислал новое сообщение в чате — звук до подписки на chat-message (например, новая группа). */
export function emitIncomingChatMessageHint(detail: IncomingChatMessageHintDetail): void {
  emit(EVT_INCOMING_CHAT_MESSAGE_HINT, detail);
}

export function onIncomingChatMessageHint(handler: (detail: IncomingChatMessageHintDetail) => void): () => void {
  return on(EVT_INCOMING_CHAT_MESSAGE_HINT, handler);
}

export function emitChatRead(detail: ChatReadEventDetail): void {
  emit(EVT_CHAT_READ, detail);
}

export function onChatRead(handler: (detail: ChatReadEventDetail) => void): () => void {
  return on(EVT_CHAT_READ, handler);
}

export function emitMessageReaction(detail: MessageReactionEventDetail): void {
  emit(EVT_MESSAGE_REACTION, detail);
}

export function onMessageReaction(handler: (detail: MessageReactionEventDetail) => void): () => void {
  return on(EVT_MESSAGE_REACTION, handler);
}

export function emitMessageEdited(detail: MessageEditedEventDetail): void {
  emit(EVT_MESSAGE_EDITED, detail);
}

export function onMessageEdited(handler: (detail: MessageEditedEventDetail) => void): () => void {
  return on(EVT_MESSAGE_EDITED, handler);
}

export function emitChatVibeUpdate(detail: ChatVibeUpdateDetail): void {
  emit(EVT_CHAT_VIBE_UPDATE, detail);
}

export function onChatVibeUpdate(handler: (detail: ChatVibeUpdateDetail) => void): () => void {
  return on(EVT_CHAT_VIBE_UPDATE, handler);
}
