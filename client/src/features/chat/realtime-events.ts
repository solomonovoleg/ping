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

export type ChatVibeTensionPulseDetail = {
  chatId: string;
  senderId: string;
  at: number;
};

/** WS «пульс передачи» из композера лички (собеседник + список чатов). */
export type ComposerTransferPulseDetail = {
  chatId: string;
  userId: string;
  displayName: string | null;
  at: number;
};

const EVT_CHAT_LIST_UPDATE = "ping:chat-list-update";
const EVT_INCOMING_CHAT_MESSAGE_HINT = "ping:incoming-chat-message-hint";
const EVT_REALTIME_SOCKET_CONNECTED = "ping:realtime-socket-connected";
const EVT_CHAT_READ = "ping:chat-read";
const EVT_MESSAGE_REACTION = "ping:message-reaction";
const EVT_MESSAGE_EDITED = "ping:message-edited";
const EVT_CHAT_VIBE_UPDATE = "ping:chat-vibe-update";
const EVT_CHAT_VIBE_TENSION_PULSE = "ping:chat-vibe-tension-pulse";
const EVT_COMPOSER_TRANSFER_PULSE = "ping:composer-transfer-pulse";
const EVT_COMPOSER_PULSE_PENDING_RESOLVED = "ping:composer-pulse-pending-resolved";

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

/** После открытия /calls WebSocket (в т.ч. реконнект): подтянуть метаданные открытого чата, если вкладка видима. */
export function emitRealtimeSocketConnected(): void {
  emit(EVT_REALTIME_SOCKET_CONNECTED);
}

export function onRealtimeSocketConnected(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVT_REALTIME_SOCKET_CONNECTED, handler);
  return () => window.removeEventListener(EVT_REALTIME_SOCKET_CONNECTED, handler);
}

export type IncomingChatMessageHintDetail = { chatId: string; senderId: string };

/** Сервер прислал новое сообщение в чате — звук до подписки на chat-message (например, новая группа). */
export function emitIncomingChatMessageHint(detail: IncomingChatMessageHintDetail): void {
  emit(EVT_INCOMING_CHAT_MESSAGE_HINT, detail);
}

export function onIncomingChatMessageHint(handler: (detail: IncomingChatMessageHintDetail) => void): () => void {
  return on(EVT_INCOMING_CHAT_MESSAGE_HINT, handler);
}

export function emitChatPendingUnread(detail: { chatId: string }): void {
  emit(EVT_CHAT_PENDING_UNREAD, detail);
}

export function onChatPendingUnread(handler: (detail: { chatId: string }) => void): () => void {
  return on(EVT_CHAT_PENDING_UNREAD, handler);
}

export function emitChatPendingUnreadClear(detail: { chatId: string }): void {
  emit(EVT_CHAT_PENDING_UNREAD_CLEAR, detail);
}

export function onChatPendingUnreadClear(handler: (detail: { chatId: string }) => void): () => void {
  return on(EVT_CHAT_PENDING_UNREAD_CLEAR, handler);
}

/** Входящее сообщение по WS: клиент может показать бейдж до refetch /chats (если серверный unread ещё не пришёл). */
const EVT_CHAT_PENDING_UNREAD = "ping:chat-pending-unread";
/** Локально после успешного PUT /read (сервер не шлёт chat-read самому читателю). */
const EVT_CHAT_PENDING_UNREAD_CLEAR = "ping:chat-pending-unread-clear";

const EVT_GROUP_CALL_INVITE = "ping:group-call-invite";

export type GroupCallInviteDetail = {
  chatId: string;
  roomId: string;
  mediaType: "audio" | "video";
  hostUserId: string;
  chatTitle?: string | null;
};

export function emitGroupCallInvite(detail: GroupCallInviteDetail): void {
  emit(EVT_GROUP_CALL_INVITE, detail);
}

export function onGroupCallInvite(handler: (detail: GroupCallInviteDetail) => void): () => void {
  return on(EVT_GROUP_CALL_INVITE, handler);
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

export function emitChatVibeTensionPulse(detail: ChatVibeTensionPulseDetail): void {
  emit(EVT_CHAT_VIBE_TENSION_PULSE, detail);
}

export function onChatVibeTensionPulse(handler: (detail: ChatVibeTensionPulseDetail) => void): () => void {
  return on(EVT_CHAT_VIBE_TENSION_PULSE, handler);
}

export function emitComposerTransferPulse(detail: ComposerTransferPulseDetail): void {
  emit(EVT_COMPOSER_TRANSFER_PULSE, detail);
}

export function onComposerTransferPulse(handler: (detail: ComposerTransferPulseDetail) => void): () => void {
  return on(EVT_COMPOSER_TRANSFER_PULSE, handler);
}

export function emitComposerPulsePendingResolved(detail: { chatId: string }): void {
  emit(EVT_COMPOSER_PULSE_PENDING_RESOLVED, detail);
}

export function onComposerPulsePendingResolved(handler: (detail: { chatId: string }) => void): () => void {
  return on(EVT_COMPOSER_PULSE_PENDING_RESOLVED, handler);
}
