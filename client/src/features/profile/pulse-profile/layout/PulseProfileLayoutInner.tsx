import { usePulseProfileTheme } from "../pulse-profile-theme";
import { usePrefersReducedMotion } from "@/lib/motion";
import { PULSE_PROFILE_NAV_CONTENT_PB } from "./constants";
import type { PulseProfileLayoutProps } from "./types";
import { usePulseProfileLayoutScroll } from "./hooks/usePulseProfileLayoutScroll";
import { buildPulseProfileMetaLine } from "./pulse-profile-meta-line";
import { PulseProfileLayoutCoverSection } from "./PulseProfileLayoutCoverSection";
import { PulseProfileLayoutIdentityPinsSection } from "./PulseProfileLayoutIdentityPinsSection";
import { PulseProfileLayoutTabsAndFeed } from "./PulseProfileLayoutTabsAndFeed";
import { PulseProfileHeroCard } from "./PulseProfileHeroCard";
import { PulseProfileLayoutKeyframes } from "./PulseProfileLayoutKeyframes";

export function PulseProfileLayoutInner(props: PulseProfileLayoutProps) {
  const {
    renderCover = true,
    onScrollYChange,
    scrollRef,
    coverUrl,
    onCoverError,
    onBack,
    onMore,
    usernamePill,
    onUsernamePillPress,
    displayName,
    showVerified,
    isBusinessApproved = false,
    idChip,
    businessChip = null,
    genderChip,
    birthChip,
    cityChip = null,
    bio,
    linkDisplay,
    linkHref,
    businessContactPhone = null,
    businessAddress = null,
    postsCount,
    followersCount,
    followingCount,
    onFollowersClick,
    onFollowingClick,
    onPostsStatClick,
    actionRow,
    onHighlightNew,
    pinnedStrip,
    mutualFollowers = null,
    activeTab,
    onTabChange,
    postView,
    onTogglePostView,
    addContentStrip,
    postsContent,
    avatarInner,
    hasStoryGradient,
    onAvatarPress,
    onAvatarPointerDown,
    onAvatarPointerUp,
    onAvatarPointerLeave,
    onAvatarPointerCancel,
    onAvatarContextMenu,
    showAvatarPlus,
    onAvatarPlusClick,
    avatarMenuOpen,
    onAvatarMenuOpenChange,
    avatarMenuItems,
  } = props;

  const { th } = usePulseProfileTheme();
  const reducedMotion = usePrefersReducedMotion();
  const scrollY = usePulseProfileLayoutScroll(scrollRef, renderCover, onScrollYChange);
  const metaLine = buildPulseProfileMetaLine({ idChip, businessChip, genderChip, birthChip, cityChip });

  return (
    <div
      className="relative isolate z-0 w-full min-h-full flex-1 select-none"
      style={{
        background: renderCover ? th.bg : "transparent",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
        color: th.text,
        paddingBottom: "var(--uix-space-4, 16px)",
      }}
    >
      <PulseProfileLayoutKeyframes />

      <div style={{ paddingBottom: PULSE_PROFILE_NAV_CONTENT_PB }}>
        {renderCover ? (
          <PulseProfileLayoutCoverSection
            coverUrl={coverUrl}
            onCoverError={onCoverError}
            scrollY={scrollY}
            usernamePill={usernamePill}
            onUsernamePillPress={onUsernamePillPress}
            onBack={onBack}
            onMore={onMore}
          />
        ) : null}

        <PulseProfileHeroCard
          coverInScrollFlow={renderCover}
          reducedMotion={reducedMotion}
          displayName={displayName}
          showVerified={showVerified}
          isBusinessApproved={isBusinessApproved}
          metaLine={metaLine}
          avatarInner={avatarInner}
          hasStoryGradient={hasStoryGradient}
          onAvatarPress={onAvatarPress}
          onAvatarPointerDown={onAvatarPointerDown}
          onAvatarPointerUp={onAvatarPointerUp}
          onAvatarPointerLeave={onAvatarPointerLeave}
          onAvatarPointerCancel={onAvatarPointerCancel}
          onAvatarContextMenu={onAvatarContextMenu}
          showAvatarPlus={showAvatarPlus}
          onAvatarPlusClick={onAvatarPlusClick}
          avatarMenuOpen={avatarMenuOpen}
          onAvatarMenuOpenChange={onAvatarMenuOpenChange}
          avatarMenuItems={avatarMenuItems}
          postsCount={postsCount}
          followersCount={followersCount}
          followingCount={followingCount}
          onPostsStatClick={onPostsStatClick}
          onFollowersClick={onFollowersClick}
          onFollowingClick={onFollowingClick}
        />

        <div style={!renderCover ? { background: th.bg } : undefined}>
          <PulseProfileLayoutIdentityPinsSection
            mutualFollowers={mutualFollowers}
            bio={bio}
            linkDisplay={linkDisplay}
            linkHref={linkHref}
            businessContactPhone={businessContactPhone}
            businessAddress={businessAddress}
            actionRow={actionRow}
            pinnedStrip={pinnedStrip}
            onHighlightNew={onHighlightNew}
          />

          <PulseProfileLayoutTabsAndFeed
            postBorder={th.postBorder}
            activeTab={activeTab}
            onTabChange={onTabChange}
            postView={postView}
            onTogglePostView={onTogglePostView}
            addContentStrip={addContentStrip}
            postsContent={postsContent}
          />
        </div>
      </div>
    </div>
  );
}
