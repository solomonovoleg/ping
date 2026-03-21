import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { usePulseProfileTheme } from "../pulse-profile-theme";
import { PULSE_PROFILE_NAV_CONTENT_PB } from "./constants";
import type { PulseProfileLayoutProps } from "./types";
import { PulseProfileCoverHeader } from "./PulseProfileCoverHeader";
import { PulseProfileHeroCard } from "./PulseProfileHeroCard";
import { PulseProfileIdentityBlock } from "./PulseProfileIdentityBlock";
import { PulseProfileLayoutKeyframes } from "./PulseProfileLayoutKeyframes";
import { PulseProfilePinnedStrip } from "./PulseProfilePinnedStrip";
import { PulseProfileTabsRow } from "./PulseProfileTabsRow";

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
    displayName,
    showVerified,
    idChip,
    genderChip,
    birthChip,
    bio,
    linkDisplay,
    linkHref,
    postsCount,
    followersCount,
    followingCount,
    onFollowersClick,
    onFollowingClick,
    onPostsStatClick,
    actionRow,
    onHighlightNew,
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
  const [scrollY, setScrollY] = useState(0);

  const metaParts: string[] = [];
  if (idChip) metaParts.push(idChip);
  if (genderChip) metaParts.push(genderChip);
  if (birthChip) metaParts.push(`🎂 ${birthChip}`);
  const metaLine = metaParts.join(" · ");

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fn = () => {
      const y = el.scrollTop;
      if (renderCover) setScrollY(y);
      onScrollYChange?.(y);
    };
    el.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => el.removeEventListener("scroll", fn);
  }, [scrollRef, renderCover, onScrollYChange]);

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
          <PulseProfileCoverHeader
            coverUrl={coverUrl}
            onCoverError={onCoverError}
            scrollY={scrollY}
            usernamePill={usernamePill}
            onBack={onBack}
            onMore={onMore}
          />
        ) : null}

        <PulseProfileHeroCard
          coverInScrollFlow={renderCover}
          reducedMotion={reducedMotion}
          displayName={displayName}
          showVerified={showVerified}
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
          <PulseProfileIdentityBlock
            mutualFollowers={mutualFollowers}
            bio={bio}
            linkDisplay={linkDisplay}
            linkHref={linkHref}
            actionRow={actionRow}
          />

          <PulseProfilePinnedStrip onHighlightNew={onHighlightNew} />

          <PulseProfileTabsRow
            activeTab={activeTab}
            onTabChange={onTabChange}
            postView={postView}
            onTogglePostView={onTogglePostView}
          />

          {addContentStrip ? <div className="mx-4 mt-3 mb-1">{addContentStrip}</div> : null}

          <div className="mt-3" style={{ borderTop: `1px solid ${th.postBorder}` }}>
            {postsContent}
          </div>
        </div>
      </div>
    </div>
  );
}
