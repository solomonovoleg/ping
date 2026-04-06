import type { GlobalPublicFeedRow } from "../feed/global-feed-row";

/** Совпадает с глобальной публичной лентой (`server/feed/global-feed-row.ts`) — один контракт строки поста + author join. */
export type ListPostsFeedRow = GlobalPublicFeedRow;

export type ListPostsForViewerParams = {
  authorId?: string;
  hashtagParam?: string;
  qParam?: string;
  /** Только посты с загруженным видео в медиа (для вертикальной ленты Reels). */
  videoOnly?: boolean;
  limit: number;
  offset: number;
  viewerId: string;
};
