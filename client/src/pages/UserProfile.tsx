import { useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import {
  useUserProfilePage,
  useUserProfileStoryHighlightOpener,
  UserProfileOtherLoadingShell,
  UserProfileOtherNotFoundShell,
  UserProfileStoryViewerLayer,
  UserProfileChromeSheets,
  UserProfileMediaAndCommentsModals,
} from "@/features/profile/user-profile";
import { ReportContentDialog, type Block01ReportTarget } from "@/features/store-moderation/block-01-ugc";
import { UserProfileMainLayout } from "@/features/profile/user-profile/page/UserProfileMainLayout";

export default function UserProfile({ params: paramsProp }: { params?: { id: string } }) {
  const p = useUserProfilePage(paramsProp);
  const reducedMotion = usePrefersReducedMotion();
  const [profileBlockOpen, setProfileBlockOpen] = useState(false);
  const [profileUnblockOpen, setProfileUnblockOpen] = useState(false);
  const [profileReportTarget, setProfileReportTarget] = useState<Block01ReportTarget | null>(null);
  const [profileReportContextLine, setProfileReportContextLine] = useState<string | undefined>();
  const [profileAnalyticsOpen, setProfileAnalyticsOpen] = useState(false);
  const highlightOpener = useUserProfileStoryHighlightOpener(p.isMe, p.addingStory, p.storyFileInputRef);

  if (p.hasInvalidRouteId) return null;

  if (!p.isMe && p.profileLoading) {
    return <UserProfileOtherLoadingShell onBack={() => p.setLocation("/posts")} />;
  }
  if (!p.isMe && (p.profileNotFound || (!p.apiProfile && (p.profileError || !p.profileLoading)))) {
    return (
      <UserProfileOtherNotFoundShell
        onBack={() => p.setLocation("/posts")}
        showRetry={p.profileError}
        onRetry={() => void p.refetchOtherProfile()}
      />
    );
  }

  return (
    <>
      <UserProfileMainLayout
        p={p}
        onOpenAnalytics={() => setProfileAnalyticsOpen(true)}
        onHighlightNew={highlightOpener ?? (() => {})}
        onReportForeignPost={
          p.user
            ? (postId) => {
                setProfileReportTarget({ targetType: "post", targetId: postId });
                setProfileReportContextLine(
                  p.isMe && p.activeTab === "saved" ? "Сохранённый пост" : "Пост в профиле",
                );
              }
            : undefined
        }
      />

      <UserProfileChromeSheets
        profileAnalyticsOpen={profileAnalyticsOpen}
        onProfileAnalyticsClose={() => setProfileAnalyticsOpen(false)}
        profileMoreOpen={p.profileMoreOpen}
        onProfileMoreClose={() => p.setProfileMoreOpen(false)}
        isMe={p.isMe}
        onCopyLink={p.handleCopyLink}
        onOpenSettings={() => p.setLocation("/settings")}
        isBlockedByMe={!p.isMe && !!p.apiProfile?.isBlockedByMe}
        onRequestUnblock={
          !p.isMe && p.apiProfile?.isBlockedByMe && p.authorId ? () => setProfileUnblockOpen(true) : undefined
        }
        onRequestBlock={
          !p.isMe && p.authorId && !p.apiProfile?.isBlockedByMe ? () => setProfileBlockOpen(true) : undefined
        }
        onRequestReport={
          !p.isMe && p.authorId
            ? () => {
                const uid = p.authorId;
                if (!uid) return;
                setProfileReportTarget({ targetType: "user", targetId: uid });
                setProfileReportContextLine(
                  p.displayName ? `Профиль: ${p.displayName}` : undefined,
                );
              }
            : undefined
        }
        profileBlockOpen={profileBlockOpen}
        onProfileBlockOpenChange={setProfileBlockOpen}
        blockTargetUserId={!p.isMe && p.authorId ? p.authorId : null}
        displayName={p.displayName}
        onBlocked={() => void p.handlePullRefresh()}
        profileUnblockOpen={profileUnblockOpen}
        onProfileUnblockOpenChange={setProfileUnblockOpen}
        unblockTargetUserId={!p.isMe && p.authorId ? p.authorId : null}
        onUnblocked={() => void p.handlePullRefresh()}
      />

      <ReportContentDialog
        open={!!profileReportTarget}
        onOpenChange={(open) => {
          if (!open) {
            setProfileReportTarget(null);
            setProfileReportContextLine(undefined);
          }
        }}
        target={profileReportTarget}
        contextLine={profileReportContextLine}
      />

      {p.activeStoryIndex !== null && (p.apiStories ?? []).length > 0 ? (
        <UserProfileStoryViewerLayer
          activeStoryIndex={p.activeStoryIndex}
          apiStories={p.apiStories ?? []}
          authorId={p.authorId}
          displayName={p.displayName}
          avatarUrl={p.avatarUrl}
          viewerUserId={p.user?.id}
          isMe={p.isMe}
          onClose={() => p.setActiveStoryIndex(null)}
          storyViewersCountById={p.storyViewersCountById}
          onOpenViewers={(storyId) => p.setActiveViewersStoryId(storyId)}
          onStoryReply={p.isMe ? undefined : p.handleStoryReply}
          onToggleLike={p.handleStoryLikeToggle}
          likedByStoryId={p.likedStoryIds}
          likesCountByStoryId={p.likesCountByStoryId}
          onShareStory={p.handleStoryShare}
          onArchiveStory={p.isMe ? p.handleStoryArchive : undefined}
          onDeleteStory={p.isMe ? p.handleStoryDelete : undefined}
          onAddToPinned={
            p.isMe
              ? (storyId) => {
                  p.openProfilePinStory(storyId);
                  p.setActiveStoryIndex(null);
                }
              : undefined
          }
        />
      ) : null}

      <UserProfileMediaAndCommentsModals
        isMe={p.isMe}
        showStoryVideoTrimmer={p.showStoryVideoTrimmer}
        pendingStoryFile={p.pendingStoryFile}
        onStoryTrimmerOpenChange={p.handleStoryTrimmerOpenChange}
        onStoryVideoTrimConfirm={p.handleStoryVideoTrimConfirm}
        showStoryDurationPicker={p.showStoryDurationPicker}
        storyExpiresInHours={p.storyExpiresInHours}
        onStoryHoursChange={p.setStoryExpiresInHours}
        storyCaption={p.storyCaption}
        onStoryCaptionChange={p.setStoryCaption}
        onCancelStoryPublishFlow={p.cancelStoryPublishFlow}
        onPublishStory={p.handlePublishStory}
        addingStory={p.addingStory}
        hasPendingStoryFile={!!p.pendingStoryFile}
        storyUploadPercent={p.storyUploadPercent}
        reducedMotion={reducedMotion}
        activeViewersStoryId={p.activeViewersStoryId}
        onCloseViewers={() => p.setActiveViewersStoryId(null)}
        activeStoryViewersLoading={p.activeStoryViewersLoading}
        activeStoryViewers={p.activeStoryViewers}
        onNavigateToProfile={p.setLocation}
        activeCommentPostId={p.activeCommentPostId}
        onCloseComments={() => p.setActiveCommentPostId(null)}
        profilePosts={p.postsForCommentLookup}
      />
    </>
  );
}
