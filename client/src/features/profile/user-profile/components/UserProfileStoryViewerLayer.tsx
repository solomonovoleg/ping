import { memo, useMemo } from "react";
import StoryViewer from "@/components/StoryViewer";
import type { StoryViewerProps } from "@/components/story-viewer/types";
import { resolveUrl } from "@/lib/api-base";
import { formatPostTime } from "@/lib/posts";
import { recordStoryViewQuiet } from "@/lib/stories";

export type UserProfileStoryViewerApiItem = {
  id: string;
  mediaUrl?: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  createdAt?: string;
  authorId?: string;
  expiresAt?: string;
  likesCount?: number;
  isLiked?: boolean;
};

type Props = {
  activeStoryIndex: number;
  apiStories: UserProfileStoryViewerApiItem[];
  authorId: string | null | undefined;
  displayName: string;
  avatarUrl: string | null | undefined;
  viewerUserId: string | undefined;
  isMe: boolean;
  onClose: () => void;
  storyViewersCountById: Record<string, number>;
  onOpenViewers: NonNullable<StoryViewerProps["onOpenViewers"]>;
  onStoryReply?: StoryViewerProps["onReply"];
  onToggleLike: NonNullable<StoryViewerProps["onToggleLike"]>;
  likedByStoryId: Record<string, boolean>;
  likesCountByStoryId: Record<string, number>;
  onShareStory: NonNullable<StoryViewerProps["onShareStory"]>;
  onArchiveStory?: StoryViewerProps["onArchiveStory"];
  onDeleteStory?: StoryViewerProps["onDeleteStory"];
  onAddToPinned?: StoryViewerProps["onAddToPinned"];
};

export const UserProfileStoryViewerLayer = memo(function UserProfileStoryViewerLayer({
  activeStoryIndex,
  apiStories,
  authorId,
  displayName,
  avatarUrl,
  viewerUserId,
  isMe,
  onClose,
  storyViewersCountById,
  onOpenViewers,
  onStoryReply,
  onToggleLike,
  likedByStoryId,
  likesCountByStoryId,
  onShareStory,
  onArchiveStory,
  onDeleteStory,
  onAddToPinned,
}: Props) {
  const storiesForViewer = useMemo(
    () =>
      apiStories.map((s) => {
        const cap = typeof s.caption === "string" ? s.caption.trim() : "";
        return {
          id: s.id,
          image: resolveUrl(s.mediaUrl ?? ""),
          ...(s.thumbnailUrl ? { thumbnailUrl: resolveUrl(String(s.thumbnailUrl)) } : {}),
          userName: displayName,
          userAvatar: avatarUrl?.trim() ? avatarUrl : "",
          time: formatPostTime(s.createdAt ?? ""),
          authorId: s.authorId ?? authorId ?? undefined,
          expiresAt: s.expiresAt,
          likesCount: Number(s.likesCount ?? 0),
          isLiked: s.isLiked === true,
          ...(cap ? { caption: cap } : {}),
        };
      }),
    [apiStories, authorId, avatarUrl, displayName],
  );

  const initialIndex = Math.min(activeStoryIndex, apiStories.length - 1);

  return (
    <StoryViewer
      sessionResumeKey={authorId ? `profile-${authorId}` : undefined}
      stories={storiesForViewer}
      initialIndex={initialIndex}
      onClose={onClose}
      viewerUserId={viewerUserId}
      canSeeViewers={isMe}
      onOpenViewers={onOpenViewers}
      viewersCountByStoryId={storyViewersCountById}
      onStoryView={(storyId) => {
        if (!isMe) void recordStoryViewQuiet(storyId);
      }}
      onReply={isMe ? undefined : onStoryReply}
      canReply={!isMe}
      onToggleLike={onToggleLike}
      canLike={!isMe}
      likedByStoryId={likedByStoryId}
      likesCountByStoryId={likesCountByStoryId}
      canManage={isMe}
      onShareStory={onShareStory}
      onArchiveStory={isMe ? onArchiveStory : undefined}
      onDeleteStory={isMe ? onDeleteStory : undefined}
      onAddToPinned={onAddToPinned}
    />
  );
});
