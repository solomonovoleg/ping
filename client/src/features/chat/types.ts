/**
 * Типы для фичи «Чат». Макс. 300 строк на файл.
 */

export type ApiChat = {
  id: string;
  type: string;
  name: string | null;
  createdAt: string;
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
};

export type ApiMessage = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: string;
  content: string;
  replyToId?: string | null;
  replyTo?: { id: string; senderId: string | null; type: string; content: string };
  forwardedFromMessageId?: string | null;
  forwardedFromSenderName?: string | null;
  reactions?: { emoji: string; count: number }[];
  /** Эмодзи реакции текущего пользователя (одна на сообщение). */
  myReaction?: string | null;
  createdAt: string;
  sendStatus?: "sending" | "sent" | "failed";
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
