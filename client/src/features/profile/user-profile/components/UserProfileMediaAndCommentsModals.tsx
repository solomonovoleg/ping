import { memo } from "react";
import CommentsModal from "@/components/CommentsModal";
import { UploadProgressBlockingOverlay } from "@/components/ui/upload-progress-panel";
import { PostVideoTrimmerModal } from "@/features/posts/video-trim";
import type { PostVideoTrimUpload } from "@/lib/posts";
import type { StoryExpiresHours } from "@/lib/stories";
import { STORY_VIDEO_MAX_SECONDS } from "@shared/post-video";
import { buildProfilePath } from "@/lib/profile-route";
import type { StoryViewerUser } from "@/lib/stories";
import { StoryDurationPickerSheet } from "./StoryDurationPickerSheet";
import { StoryViewersSheet } from "./StoryViewersSheet";

type PostRef = { id: string; authorId?: string };

type Props = {
  isMe: boolean;
  showStoryVideoTrimmer: boolean;
  pendingStoryFile: File | null;
  onStoryTrimmerOpenChange: (open: boolean) => void;
  onStoryVideoTrimConfirm: (trim: PostVideoTrimUpload) => void;
  showStoryDurationPicker: boolean;
  storyExpiresInHours: StoryExpiresHours;
  onStoryHoursChange: (hours: StoryExpiresHours) => void;
  storyCaption: string;
  onStoryCaptionChange: (v: string) => void;
  onCancelStoryPublishFlow: () => void;
  onPublishStory: () => void;
  addingStory: boolean;
  hasPendingStoryFile: boolean;
  storyUploadPercent: number | null;
  reducedMotion: boolean;
  activeViewersStoryId: string | null;
  onCloseViewers: () => void;
  activeStoryViewersLoading: boolean;
  activeStoryViewers: StoryViewerUser[];
  onNavigateToProfile: (path: string) => void;
  activeCommentPostId: string | null;
  onCloseComments: () => void;
  profilePosts: PostRef[];
};

export const UserProfileMediaAndCommentsModals = memo(function UserProfileMediaAndCommentsModals({
  isMe,
  showStoryVideoTrimmer,
  pendingStoryFile,
  onStoryTrimmerOpenChange,
  onStoryVideoTrimConfirm,
  showStoryDurationPicker,
  storyExpiresInHours,
  onStoryHoursChange,
  storyCaption,
  onStoryCaptionChange,
  onCancelStoryPublishFlow,
  onPublishStory,
  addingStory,
  hasPendingStoryFile,
  storyUploadPercent,
  reducedMotion,
  activeViewersStoryId,
  onCloseViewers,
  activeStoryViewersLoading,
  activeStoryViewers,
  onNavigateToProfile,
  activeCommentPostId,
  onCloseComments,
  profilePosts,
}: Props) {
  return (
    <>
      {isMe ? (
        <PostVideoTrimmerModal
          open={showStoryVideoTrimmer}
          file={pendingStoryFile}
          onOpenChange={onStoryTrimmerOpenChange}
          onConfirm={onStoryVideoTrimConfirm}
          maxSegmentSeconds={STORY_VIDEO_MAX_SECONDS}
          title="Видео для сториз"
          description={`До ${STORY_VIDEO_MAX_SECONDS} с, как в ленте: выберите фрагмент на полоске.`}
        />
      ) : null}

      <StoryDurationPickerSheet
        open={showStoryDurationPicker}
        storyExpiresInHours={storyExpiresInHours}
        onHoursChange={onStoryHoursChange}
        storyCaption={storyCaption}
        onStoryCaptionChange={onStoryCaptionChange}
        onCancel={onCancelStoryPublishFlow}
        onPublish={onPublishStory}
        addingStory={addingStory}
        hasPendingFile={hasPendingStoryFile}
      />

      <UploadProgressBlockingOverlay
        open={isMe && addingStory}
        title="Публикация сториз"
        percent={storyUploadPercent}
        reducedMotion={reducedMotion}
        footnote={storyUploadPercent != null ? "Отправка на сервер…" : null}
        zIndexClass="z-[230]"
        ariaLabel="Публикация сториз"
      />

      <StoryViewersSheet
        open={!!activeViewersStoryId}
        onClose={onCloseViewers}
        loading={activeStoryViewersLoading}
        viewers={activeStoryViewers}
        onOpenProfile={(viewer) =>
          onNavigateToProfile(
            buildProfilePath({
              publicId: viewer.publicId,
              userId: viewer.id,
              fallbackPath: "/posts",
            }),
          )
        }
      />

      <CommentsModal
        isOpen={activeCommentPostId !== null}
        onClose={onCloseComments}
        postId={activeCommentPostId}
        postAuthorId={
          activeCommentPostId ? profilePosts.find((po) => po.id === activeCommentPostId)?.authorId : undefined
        }
      />
    </>
  );
});
