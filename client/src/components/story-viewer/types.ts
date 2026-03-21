export interface Story {
  id: string | number;
  image: string;
  userName: string;
  userAvatar: string;
  time: string;
  authorId?: string;
  expiresAt?: string;
  likesCount?: number;
  isLiked?: boolean;
}

export interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  viewerUserId?: string;
  onStoryView?: (storyId: string) => void;
  onOpenViewers?: (storyId: string) => void;
  canSeeViewers?: boolean;
  viewersCountByStoryId?: Record<string, number>;
  onReply?: (payload: {
    storyId: string;
    authorId: string;
    text: string;
    story: { id: string; image: string; userName: string; userAvatar: string; time: string };
  }) => Promise<void> | void;
  canReply?: boolean;
  onToggleLike?: (storyId: string, liked: boolean) => Promise<void> | void;
  canLike?: boolean;
  likedByStoryId?: Record<string, boolean>;
  likesCountByStoryId?: Record<string, number>;
  canManage?: boolean;
  onShareStory?: (story: { id: string; image: string; userName: string; time: string }) => Promise<void> | void;
  onArchiveStory?: (storyId: string) => Promise<void> | void;
  onDeleteStory?: (storyId: string) => Promise<void> | void;
}
