export type StoriesFeedPageResult = {
  authors: {
    authorId: string;
    author: { id: string; publicId: number; displayName: string | null; avatarUrl: string | null };
    latestStoryAt: string | null;
    hasUnseen: boolean;
    unseenCount: number;
    stories: {
      id: string;
      authorId: string;
      mediaUrl: string;
      thumbnailUrl: string | null;
      caption: string | null;
      createdAt: string;
      expiresAt: string;
      viewsCount: number;
      likesCount: number;
      isViewed: boolean;
      isLiked: boolean;
    }[];
  }[];
  nextOffset: number;
  hasMore: boolean;
};

export type StoryAuthorSnippet = {
  id: string;
  publicId: number;
  displayName: string | null;
  avatarUrl: string | null;
};

export type StoryRow = {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
  viewsCount?: number;
  likesCount?: number;
  isViewed?: boolean;
  isLiked?: boolean;
  /** Заполняется в `GET /api/stories/:id` для диплинков и клиента. */
  author?: StoryAuthorSnippet;
};
