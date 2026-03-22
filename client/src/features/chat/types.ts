/**
 * Типы для фичи «Чат». Макс. 300 строк на файл.
 */

export type ApiChatMember = {
  id: string;
  publicId?: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl?: string | null;
  role?: "admin" | "member";
};

export type ApiChat = {
  id: string;
  type: string;
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  /** Закреплён в списке (сервер). */
  pinnedAt?: string | null;
  /** Полка: general | friends | work | promo */
  listSection?: string;
  lastMessage?: { type: string; content: string; createdAt: string } | null;
  hasUnread?: boolean;
  unreadCount?: number;
  otherMemberAvatarUrl?: string | null;
  otherMemberHasActiveStory?: boolean;
  otherMemberHasUnseenStory?: boolean;
  /** Роль текущего пользователя в группе (admin | member) */
  myRole?: "admin" | "member";
  /** Участники группового чата (для отображения имени отправителя) */
  members?: ApiChatMember[];
  otherMember?: {
    id: string;
    publicId?: number;
    displayName: string | null;
    surname: string | null;
    avatarUrl: string | null;
    phone?: string | null;
    lastReadAt?: string | null;
    lastSeenAt?: string | null;
  } | null;
  /** Превью «был(а)…» в списке чатов (DM). */
  otherMemberLastSeenAt?: string | null;
};

export type ApiMessage = {
  id: string;
  chatId: string;
  folderId?: string | null;
  senderId: string | null;
  type: string;
  content: string;
  /** Транскрипт голосового сообщения (опционально). */
  transcript?: string | null;
  replyToId?: string | null;
  replyTo?: { id: string; senderId: string | null; type: string; content: string };
  forwardedFromMessageId?: string | null;
  forwardedFromSenderName?: string | null;
  reactions?: { emoji: string; count: number }[];
  /** Эмодзи реакции текущего пользователя (одна на сообщение). */
  myReaction?: string | null;
  createdAt: string;
  sendStatus?: "sending" | "sent" | "failed";
  /** Server-provided translation (when per-chat translation is enabled). */
  translatedText?: string | null;
  /** Detected source language of the translation. */
  detectedLang?: string | null;
};

export type MessageListItem =
  | { type: "date"; label: string }
  | {
      type: "message";
      msg: ApiMessage;
      dateLabel: string | null;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };
