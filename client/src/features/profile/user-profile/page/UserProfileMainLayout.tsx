import { BackgroundSyncBar } from "@/components/BackgroundSyncBar";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { FeedScrollRootContext } from "@/contexts/FeedScrollRootContext";
import {
  PulseProfileLayout,
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
} from "@/features/profile/pulse-profile";
import { buildProfileFollowersPath, buildProfileFollowingPath } from "@/lib/profile-route";
import { UserProfileBlockedByPeerBanner } from "../components/UserProfileBlockedByPeerBanner";
import { UserProfilePostsFeedSlot } from "../components/UserProfilePostsFeedSlot";
import { UserProfilePulseActionRow } from "../components/UserProfilePulseActionRow";
import { UserProfilePushSubscribeRow } from "../components/UserProfilePushSubscribeRow";
import { UserProfilePulseAddContentStripGate } from "../components/UserProfilePulseAddContentStripGate";
import { UserProfilePulsePinnedStrip } from "../components/UserProfilePulsePinnedStrip";
import { UserProfileStoryFileInput } from "../components/UserProfileStoryFileInput";
import type { useUserProfilePage } from "../useUserProfilePage";

type ProfilePageState = ReturnType<typeof useUserProfilePage>;

type UserProfileMainLayoutProps = {
  p: ProfilePageState;
  onOpenAnalytics: () => void;
  onHighlightNew: () => void;
  onReportForeignPost?: (postId: string) => void;
};

export function UserProfileMainLayout({
  p,
  onOpenAnalytics,
  onHighlightNew,
  onReportForeignPost,
}: UserProfileMainLayoutProps) {
  const businessStatus = p.isMe
    ? ((p.user as { businessStatus?: string | null } | null)?.businessStatus ?? "none")
    : (p.apiProfile?.businessStatus ?? "none");
  const isBusinessApproved = businessStatus === "approved";
  const businessContactPhone = p.isMe
    ? ((p.user as { businessContactPhone?: string | null } | null)?.businessContactPhone ?? null)
    : (p.apiProfile?.businessContactPhone ?? null);
  const businessAddress = p.isMe
    ? ((p.user as { businessAddress?: string | null } | null)?.businessAddress ?? null)
    : (p.apiProfile?.businessAddress ?? null);

  const postsContent = (
    <UserProfilePostsFeedSlot
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
      pinnedPostId={p.profilePinnedPostId}
      pinProfilePostMutation={p.pinProfilePostMutation}
      onReportForeignPost={onReportForeignPost}
    />
  );

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overscroll-y-none"
      data-pull-refresh-scope
    >
      <FeedScrollRootContext.Provider value={p.pulseScrollRef}>
        <PullToRefresh
          scrollRef={p.pulseScrollRef}
          onRefresh={p.handlePullRefresh}
          className="min-h-0 flex-1"
          disabled={p.pullRefreshDisabled}
        >
          {!p.isMe && p.apiProfile?.blockedByProfileOwner?.restrictChat ? (
            <UserProfileBlockedByPeerBanner note={p.apiProfile.blockedByProfileOwner.note} />
          ) : null}
          {!p.isMe && p.otherProfileBackgroundRefreshing ? (
            <BackgroundSyncBar
              active
              className="w-full shrink-0"
              label="Обновление профиля"
            />
          ) : null}
          {!p.isMe && p.softRefreshError ? (
            <div className="mx-3 mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="flex items-center justify-between gap-3">
                <span>{p.softRefreshError}</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                    onClick={() => void p.handlePullRefresh()}
                  >
                    Повторить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    aria-label="Скрыть сообщение об ошибке обновления"
                    onClick={() => p.setSoftRefreshError(null)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {p.isMe ? (
            <UserProfileStoryFileInput inputRef={p.storyFileInputRef} onFile={p.handleStoryFileSelect} />
          ) : null}
          <PulseProfileLayout
            scrollRef={p.pulseScrollRef}
            coverUrl={p.hasCover ? p.resolvedCoverUrl : null}
            onCoverError={() => p.setCoverLoadError(true)}
            onBack={() => p.setLocation("/posts")}
            onMore={() => p.setProfileMoreOpen(true)}
            usernamePill={p.usernamePillText}
            onUsernamePillPress={p.handleCopyLink}
            displayName={p.displayName}
            showVerified={Number(p.publicIdStr) === 2}
            isBusinessApproved={isBusinessApproved}
            idChip={Number(p.publicIdStr) === 2 ? "Founder · ID 2" : `ID ${p.publicIdStr}`}
            businessChip={isBusinessApproved ? "Business verified" : null}
            genderChip={p.genderChip}
            birthChip={p.birthChip}
            cityChip={p.cityChip}
            bio={p.isMe ? (p.user as { bio?: string | null })?.bio ?? null : p.apiProfile?.bio ?? null}
            linkDisplay={p.profileLinkTrim || null}
            linkHref={p.profileLinkHref}
            businessContactPhone={businessContactPhone}
            businessAddress={businessAddress}
            postsCount={p.isMe ? (p.myProfileStats?.postsCount ?? p.profilePosts.length) : (p.apiProfile?.postsCount ?? 0)}
            followersCount={p.isMe ? (p.myProfileStats?.followersCount ?? 0) : (p.apiProfile?.followersCount ?? 0)}
            followingCount={p.isMe ? (p.myProfileStats?.followingCount ?? 0) : (p.apiProfile?.followingCount ?? 0)}
            onFollowersClick={() =>
              p.setLocation(buildProfileFollowersPath({ isMe: p.isMe, userId: p.normalizedRouteId, fallbackPath: "/posts" }))
            }
            onFollowingClick={() =>
              p.setLocation(buildProfileFollowingPath({ isMe: p.isMe, userId: p.normalizedRouteId, fallbackPath: "/posts" }))
            }
            actionRow={
              <UserProfilePulseActionRow
                isMe={p.isMe}
                onOpenAnalytics={onOpenAnalytics}
                onEditProfile={() => p.setLocation("/profile/edit")}
                onCopyLink={p.handleCopyLink}
                otherProfile={
                  p.isMe
                    ? null
                    : {
                        isFollowing: !!p.apiProfile?.isFollowing,
                        isMutualFollow: !!p.apiProfile?.isMutualFollow,
                        canMessage: !!p.apiProfile?.canMessage,
                      }
                }
                followLoading={p.followLoading}
                onFollowToggle={p.handleFollowToggle}
                onStartChat={p.handleStartChat}
                pushMiddleSlot={
                  !p.isMe && p.user?.id && p.authorId && p.authorId !== p.user.id ? (
                    <UserProfilePushSubscribeRow
                      authorId={p.authorId}
                      viewerUserId={p.user.id}
                      isBlockedByMe={!!p.apiProfile?.isBlockedByMe}
                    />
                  ) : null
                }
              />
            }
            onHighlightNew={onHighlightNew}
            pinnedStrip={
              <UserProfilePulsePinnedStrip
                profileRouteId={p.isMe ? "me" : p.normalizedRouteId}
                isMe={p.isMe}
                onHighlightNew={onHighlightNew}
                pinAdd={p.profilePinAdd}
                onClearPinAdd={p.clearProfilePinAdd}
                onOpenPinnedPost={p.handleOpenPinnedPost}
                onOpenPinnedStory={p.handleOpenPinnedStory}
                profilePinnedPostId={p.profilePinnedPostId}
                profilePinnedPreview={p.profilePinnedPreview}
              />
            }
            mutualFollowers={!p.isMe ? p.apiProfile?.mutualFollowers ?? null : null}
            activeTab={p.activeTab}
            onTabChange={p.setActiveTab}
            postView={p.postViewMode}
            onTogglePostView={() => p.setPostViewMode((v) => (v === "list" ? "grid" : "list"))}
            addContentStrip={
              <UserProfilePulseAddContentStripGate
                isMe={p.isMe}
                activeTab={p.activeTab}
                onCreatePost={() => p.setLocation("/create-post")}
              />
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
      </FeedScrollRootContext.Provider>
    </div>
  );
}
