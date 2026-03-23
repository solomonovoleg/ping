import { useState } from "react";
import StoryViewer from "@/components/StoryViewer";
import CommentsModal from "@/components/CommentsModal";
import { formatPostTime } from "@/lib/posts";
import { PullToRefresh } from "@/components/PullToRefresh";
import { resolveUrl } from "@/lib/api-base";
import { recordStoryView } from "@/lib/stories";
import { buildProfilePath } from "@/lib/profile-route";
import {
  PulseProfileLayout,
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
  PulseProfileAddContentStrip,
} from "@/features/profile/pulse-profile";
import { UserAvatar } from "@/components/UserAvatar";
import {
  useUserProfilePage,
  ProfileMePulseActions,
  ProfileOtherPulseActions,
  UserProfileOtherLoadingShell,
  UserProfileOtherNotFoundShell,
  UserProfilePostsContent,
  UserProfileMoreSheet,
  StoryDurationPickerSheet,
  StoryViewersSheet,
  ProfileAnalyticsSheet,
} from "@/features/profile/user-profile";
import { ProfilePinsSection } from "@/features/profile/user-profile/components/profile-pins/ProfilePinsSection";
import {
  UserBlockAlertDialog,
  UserUnblockAlertDialog,
  BlockedByPeerComposer,
} from "@/features/user-blocking";

export default function UserProfile({ params: paramsProp }: { params?: { id: string } }) {
  const p = useUserProfilePage(paramsProp);
  const [profileBlockOpen, setProfileBlockOpen] = useState(false);
  const [profileUnblockOpen, setProfileUnblockOpen] = useState(false);
  const [profileAnalyticsOpen, setProfileAnalyticsOpen] = useState(false);

  if (p.hasInvalidRouteId) return null;

  if (!p.isMe && p.profileLoading) {
    return <UserProfileOtherLoadingShell onBack={() => p.setLocation("/posts")} />;
  }
  if (!p.isMe && (p.profileError || !p.apiProfile)) {
    return <UserProfileOtherNotFoundShell onBack={() => p.setLocation("/posts")} />;
  }

  const postsContent = (
    <UserProfilePostsContent
      activeTab={p.activeTab}
      postViewMode={p.postViewMode}
      profilePosts={p.profilePosts}
      isMe={p.isMe}
      normalizedRouteId={p.normalizedRouteId}
      authorId={p.authorId}
      authorIdReady={p.authorIdReady}
      postsError={p.postsError}
      postsErrorDetail={p.postsErrorDetail}
      postsFetching={p.postsFetching}
      refetchPosts={p.refetchPosts}
      setLocation={p.setLocation}
      displayName={p.displayName}
      avatarUrl={p.avatarUrl}
      deletePostMutation={p.deletePostMutation}
      savePostMutation={p.savePostMutation}
      viewerCanSave={!!p.user}
      reactionMutation={p.reactionMutation}
      showReactionPicker={p.showReactionPicker}
      setShowReactionPicker={p.setShowReactionPicker}
      setActiveCommentPostId={p.setActiveCommentPostId}
      onOpenPinPost={p.openProfilePinPost}
    />
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overscroll-y-none">
      <PullToRefresh
        scrollRef={p.pulseScrollRef}
        onRefresh={p.handlePullRefresh}
        className="min-h-0 flex-1"
        disabled={p.pullRefreshDisabled}
      >
        {!p.isMe && p.apiProfile?.blockedByProfileOwner?.restrictChat ? (
          <div className="relative z-[1] shrink-0 px-3 pt-2">
            <BlockedByPeerComposer
              note={p.apiProfile.blockedByProfileOwner.note}
              className="rounded-2xl border border-border/50 bg-muted/20 px-3 py-3 text-center text-sm text-muted-foreground"
            />
          </div>
        ) : null}
        {p.isMe ? (
          <input
            ref={p.storyFileInputRef}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              p.handleStoryFileSelect(file);
            }}
          />
        ) : null}
        <PulseProfileLayout
          scrollRef={p.pulseScrollRef}
          coverUrl={p.hasCover ? p.resolvedCoverUrl : null}
          onCoverError={() => p.setCoverLoadError(true)}
          onBack={() => p.setLocation("/posts")}
          onMore={() => p.setProfileMoreOpen(true)}
          usernamePill={p.usernamePillText}
          displayName={p.displayName}
          showVerified
          idChip={Number(p.publicIdStr) === 2 ? "Founder · ID 2" : `ID ${p.publicIdStr}`}
          genderChip={p.genderChip}
          birthChip={p.birthChip}
          cityChip={p.cityChip}
          bio={p.isMe ? (p.user as { bio?: string | null })?.bio ?? null : p.apiProfile?.bio ?? null}
          linkDisplay={p.profileLinkTrim || null}
          linkHref={p.profileLinkHref}
          postsCount={p.isMe ? (p.myProfileStats?.postsCount ?? p.profilePosts.length) : (p.apiProfile?.postsCount ?? 0)}
          followersCount={p.isMe ? (p.myProfileStats?.followersCount ?? 0) : (p.apiProfile?.followersCount ?? 0)}
          followingCount={p.isMe ? (p.myProfileStats?.followingCount ?? 0) : (p.apiProfile?.followingCount ?? 0)}
          onFollowersClick={() =>
            p.setLocation(`/profile/${encodeURIComponent(p.isMe ? "me" : p.normalizedRouteId)}/followers`)
          }
          onFollowingClick={() =>
            p.setLocation(`/profile/${encodeURIComponent(p.isMe ? "me" : p.normalizedRouteId)}/following`)
          }
          actionRow={
            p.isMe ? (
              <ProfileMePulseActions
                onEdit={() => p.setLocation("/profile/edit")}
                onShare={p.handleCopyLink}
                onStats={() => setProfileAnalyticsOpen(true)}
              />
            ) : (
              <ProfileOtherPulseActions
                isFollowing={!!p.apiProfile?.isFollowing}
                isMutualFollow={!!p.apiProfile?.isMutualFollow}
                followLoading={p.followLoading}
                onFollow={p.handleFollowToggle}
                onMessage={p.handleStartChat}
                canMessage={!!p.apiProfile?.canMessage}
              />
            )
          }
          onHighlightNew={p.isMe ? () => !p.addingStory && p.storyFileInputRef.current?.click() : undefined}
          pinnedStrip={
            <ProfilePinsSection
              profileRouteId={p.isMe ? "me" : p.normalizedRouteId}
              isMe={p.isMe}
              onHighlightNew={p.isMe ? () => !p.addingStory && p.storyFileInputRef.current?.click() : undefined}
              pinAdd={p.profilePinAdd}
              onClearPinAdd={p.clearProfilePinAdd}
              onOpenPinnedPost={p.handleOpenPinnedPost}
              onOpenPinnedStory={p.handleOpenPinnedStory}
            />
          }
          mutualFollowers={!p.isMe ? p.apiProfile?.mutualFollowers ?? null : null}
          activeTab={p.activeTab}
          onTabChange={p.setActiveTab}
          postView={p.postViewMode}
          onTogglePostView={() => p.setPostViewMode((v) => (v === "list" ? "grid" : "list"))}
          addContentStrip={
            p.isMe && p.activeTab === "posts" ? (
              <PulseProfileAddContentStrip onClick={() => p.setLocation("/create-post")} disabled={false} />
            ) : null
          }
          postsContent={postsContent}
          avatarInner={
            <UserAvatar
              avatarUrl={p.avatarUrl ?? undefined}
              displayName={p.displayName}
              seed={p.authorId ?? ""}
              size={PULSE_PROFILE_AVATAR_INNER_PX}
              cornerRadius={PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX}
              className="h-full w-full object-cover"
            />
          }
          onAvatarPress={p.handleAvatarMainClick}
          onAvatarPointerDown={p.isMe ? p.handleAvatarPointerDownMe : undefined}
          onAvatarPointerUp={p.isMe ? p.clearAvatarLongPress : undefined}
          onAvatarPointerLeave={p.isMe ? p.clearAvatarLongPress : undefined}
          onAvatarPointerCancel={p.isMe ? p.clearAvatarLongPress : undefined}
          onAvatarContextMenu={p.isMe ? (e) => e.preventDefault() : undefined}
          showAvatarPlus={p.isMe}
          onAvatarPlusClick={() => p.setPulseAvatarMenuOpen((o) => !o)}
          avatarMenuOpen={p.pulseAvatarMenuOpen}
          onAvatarMenuOpenChange={p.setPulseAvatarMenuOpen}
          avatarMenuItems={
            p.isMe
              ? [
                  { label: "Добавить сторис", onClick: () => p.storyFileInputRef.current?.click() },
                  { label: "Редактировать профиль", onClick: () => p.setLocation("/profile/edit") },
                  { label: "Обложка профиля", onClick: () => p.setLocation("/profile/edit") },
                ]
              : []
          }
          hasStoryGradient={p.hasStories}
        />
      </PullToRefresh>

      <ProfileAnalyticsSheet open={profileAnalyticsOpen} onClose={() => setProfileAnalyticsOpen(false)} />

      <UserProfileMoreSheet
        open={p.profileMoreOpen}
        onClose={() => p.setProfileMoreOpen(false)}
        isMe={p.isMe}
        onCopyLink={p.handleCopyLink}
        onOpenSettings={() => p.setLocation("/settings")}
        isBlockedByMe={!p.isMe && !!p.apiProfile?.isBlockedByMe}
        onUnblockUser={
          !p.isMe && p.apiProfile?.isBlockedByMe && p.authorId ? () => setProfileUnblockOpen(true) : undefined
        }
        onBlockUser={
          !p.isMe && p.authorId && !p.apiProfile?.isBlockedByMe ? () => setProfileBlockOpen(true) : undefined
        }
      />

      <UserBlockAlertDialog
        open={profileBlockOpen}
        onOpenChange={setProfileBlockOpen}
        targetUserId={!p.isMe && p.authorId ? p.authorId : null}
        targetDisplayName={p.displayName}
        initialPreset="full"
        onBlocked={() => void p.handlePullRefresh()}
      />

      <UserUnblockAlertDialog
        open={profileUnblockOpen}
        onOpenChange={setProfileUnblockOpen}
        targetUserId={!p.isMe && p.authorId ? p.authorId : null}
        targetDisplayName={p.displayName}
        onUnblocked={() => void p.handlePullRefresh()}
      />

      {p.activeStoryIndex !== null && (p.apiStories ?? []).length > 0 && (
        <StoryViewer
          stories={(p.apiStories ?? []).map((s) => ({
            id: s.id,
            image: resolveUrl((s as { mediaUrl?: string }).mediaUrl ?? ""),
            ...((s as { thumbnailUrl?: string | null }).thumbnailUrl
              ? { thumbnailUrl: resolveUrl(String((s as { thumbnailUrl?: string | null }).thumbnailUrl)) }
              : {}),
            userName: p.displayName,
            userAvatar:
              resolveUrl(p.avatarUrl ?? "") ||
              resolveUrl(
                (p.apiStories?.[0] as { thumbnailUrl?: string; mediaUrl?: string })?.thumbnailUrl ??
                  (p.apiStories?.[0] as { mediaUrl?: string })?.mediaUrl ??
                  ""
              ),
            time: formatPostTime((s as { createdAt?: string }).createdAt ?? ""),
            authorId: (s as { authorId?: string }).authorId ?? (p.authorId ?? undefined),
            expiresAt: (s as { expiresAt?: string }).expiresAt,
            likesCount: Number((s as { likesCount?: number }).likesCount ?? 0),
            isLiked: (s as { isLiked?: boolean }).isLiked === true,
          }))}
          initialIndex={Math.min(p.activeStoryIndex, (p.apiStories ?? []).length - 1)}
          onClose={() => p.setActiveStoryIndex(null)}
          viewerUserId={p.user?.id}
          canSeeViewers={p.isMe}
          onOpenViewers={(storyId) => p.setActiveViewersStoryId(storyId)}
          viewersCountByStoryId={p.storyViewersCountById}
          onStoryView={(storyId) => {
            if (!p.isMe) void recordStoryView(storyId);
          }}
          onReply={p.isMe ? undefined : p.handleStoryReply}
          canReply={!p.isMe}
          onToggleLike={p.handleStoryLikeToggle}
          canLike={!p.isMe}
          likedByStoryId={p.likedStoryIds}
          likesCountByStoryId={p.likesCountByStoryId}
          canManage={p.isMe}
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
      )}

      <StoryDurationPickerSheet
        open={p.showStoryDurationPicker}
        storyExpiresInHours={p.storyExpiresInHours}
        onHoursChange={p.setStoryExpiresInHours}
        onCancel={() => {
          p.setShowStoryDurationPicker(false);
          p.setPendingStoryFile(null);
        }}
        onPublish={p.handlePublishStory}
        addingStory={p.addingStory}
        hasPendingFile={!!p.pendingStoryFile}
      />

      <StoryViewersSheet
        open={!!p.activeViewersStoryId}
        onClose={() => p.setActiveViewersStoryId(null)}
        loading={p.activeStoryViewersLoading}
        viewers={p.activeStoryViewers}
        onOpenProfile={(viewer) =>
          p.setLocation(
            buildProfilePath({
              publicId: viewer.publicId,
              userId: viewer.id,
              fallbackPath: "/posts",
            })
          )
        }
      />

      <CommentsModal
        isOpen={p.activeCommentPostId !== null}
        onClose={() => p.setActiveCommentPostId(null)}
        postId={p.activeCommentPostId}
        postAuthorId={
          p.activeCommentPostId
            ? p.profilePosts.find((po) => po.id === p.activeCommentPostId)?.authorId
            : undefined
        }
      />
    </div>
  );
}
