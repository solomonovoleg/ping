import type { PushTtlValue } from "@shared/schema";

export type PushQuota = {
  maxPerDay: number;
  used: number;
  remaining: number;
  /** Подписаны и не скрыли вас — увидят карточку в разделе Push. */
  subscribersInFeed: number;
  /** Получат push на устройство (включены уведомления у подписчика и глобально). */
  notifyRecipients: number;
};

export type PushFeedAuthor = {
  id: string;
  publicId: number | null;
  displayName: string;
  avatarUrl: string | null;
  isBusiness: boolean;
  notificationsEnabled: boolean;
};

export type PushFeedItem = {
  id: string;
  postId: string;
  postLinkCode: string | null;
  postAuthorId: string;
  postAuthorPublicId: number | null;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[];
  createdAt: string;
  expiresAt: string | null;
  ttl: PushTtlValue;
  /** Уникальные зрители (подписчики, зафиксировавшие показ карточки). */
  uniqueViewsCount: number;
  reactionsCount: number;
  repliesCount: number;
  /** Реакция текущего пользователя на эту карточку, если есть. */
  myReaction: string | null;
  latestReply: {
    id: string;
    text: string;
    visibility: "public" | "private";
    createdAt: string | null;
    author: PushFeedAuthor;
  } | null;
  author: PushFeedAuthor;
};
