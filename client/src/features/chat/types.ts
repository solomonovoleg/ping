/**
 * Типы для фичи «Чат». Макс. 300 строк на файл.
 */

import type { ClientOutgoingSendStatus } from "@shared/message-delivery-status";

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
  /** Личка 1:1: мультиязычный режим (входящие каждого на своём языке). */
  dmMultilingualEnabled?: boolean;
  name: string | null;
  avatarUrl?: string | null;
  shortCode?: string | null;
  /** Код ссылки /invite/{code} для группы; выдаётся участникам чата. */
  inviteCode?: string | null;
  createdAt: string;
  /** Закреплён в списке (сервер). */
  pinnedAt?: string | null;
  /** Полка: general | friends | work | promo | invitations */
  listSection?: string;
  lastMessage?: { type: string; content: string; createdAt: string; senderId?: string | null } | null;
  /** Метка прочитанности текущего пользователя (для скролла к первому непрочитанному). */
  myLastReadAt?: string | null;
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
    lastReadAt?: string | null;
    lastSeenAt?: string | null;
  } | null;
  /** Превью «был(а)…» в списке чатов (DM). */
  otherMemberLastSeenAt?: string | null;
  /** DM: собеседник ограничил текущего пользователя (чат/профиль/лента). */
  blockedByOther?: {
    restrictChat: boolean;
    restrictProfile: boolean;
    restrictSocial: boolean;
    note: string | null;
  } | null;
  /** DM: вы ограничили собеседника (для пункта «Разблокировать» в меню). */
  myBlockOfOther?: {
    restrictChat: boolean;
    restrictProfile: boolean;
    restrictSocial: boolean;
  } | null;
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
  sendStatus?: ClientOutgoingSendStatus;
  /** Server-provided translation (when per-chat translation is enabled). */
  translatedText?: string | null;
  /** Язык, в который переведён translatedText (совпадает с prefs при доставке по WS). */
  translateTargetLang?: string | null;
  /** Detected source language of the translation. */
  detectedLang?: string | null;
  /** Для video_note: URL постера (статичный кадр до загрузки видео). */
  videoPosterUrl?: string | null;
  /** Только клиент: прогресс загрузки исходящего вложения (0–100), убирается после отправки. */
  localUploadProgress?: number | null;
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
