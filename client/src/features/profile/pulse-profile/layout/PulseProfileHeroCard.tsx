import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { usePulseProfileTheme } from "../pulse-profile-theme";
import { PULSE_PROFILE_CARD_OVERLAP_PX } from "./constants";
import { pulseProfileHeroSeparators } from "./pulse-profile-hero-separators";
import { PulseProfileHeroAvatarCluster } from "./PulseProfileHeroAvatarCluster";
import { PulseProfileHeroAvatarMenuRow } from "./PulseProfileHeroAvatarMenuRow";
import { PulseProfileHeroStatsRow } from "./PulseProfileHeroStatsRow";
import { PulseProfileHeroTitleBlock } from "./PulseProfileHeroTitleBlock";

export function PulseProfileHeroCard({
  coverInScrollFlow = true,
  reducedMotion,
  displayName,
  showVerified,
  isBusinessApproved = false,
  metaLine,
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
  postsCount,
  followersCount,
  followingCount,
  onPostsStatClick,
  onFollowersClick,
  onFollowingClick,
}: {
  /** `false`, когда обложка в оверлее: без отрицательного margin, карточка выше по z-index скролла. */
  coverInScrollFlow?: boolean;
  reducedMotion: boolean;
  displayName: string;
  showVerified: boolean;
  isBusinessApproved?: boolean;
  /** Одна строка метаданных: «Founder · ID … · …» */
  metaLine: string;
  avatarInner: ReactNode;
  hasStoryGradient: boolean;
  onAvatarPress: () => void;
  onAvatarPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerLeave?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerCancel?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
  showAvatarPlus: boolean;
  onAvatarPlusClick: () => void;
  avatarMenuOpen: boolean;
  onAvatarMenuOpenChange: (open: boolean) => void;
  avatarMenuItems: { label: string; onClick: () => void }[];
  postsCount: number;
  followersCount: number;
  followingCount: number;
  onPostsStatClick?: () => void;
  onFollowersClick: () => void;
  onFollowingClick: () => void;
}) {
  const { th, isDark } = usePulseProfileTheme();
  const { statSep, nameSep } = pulseProfileHeroSeparators(isDark);
  const showAvatarMenu = avatarMenuOpen && avatarMenuItems.length > 0;

  return (
    <div
      className={coverInScrollFlow ? "relative z-10 mx-3 mb-1" : "relative z-30 mx-3 mb-1"}
      style={{ marginTop: coverInScrollFlow ? -PULSE_PROFILE_CARD_OVERLAP_PX : 0 }}
    >
      <div
        className="rounded-3xl px-4 pb-3 pt-1"
        style={{
          background: isDark
            ? "linear-gradient(160deg, rgba(18,14,38,0.52) 0%, rgba(10,10,22,0.48) 100%)"
            : "#ffffff",
          border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.07)",
          backdropFilter: isDark ? "blur(40px) saturate(220%)" : "none",
          WebkitBackdropFilter: isDark ? "blur(40px) saturate(220%)" : "none",
          boxShadow: isDark
            ? `0 4px 40px rgba(0,0,0,0.65), 0 0 0 1px ${th.accent}22, inset 0 1.5px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.05)`
            : "0 1px 2px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center gap-5">
          <PulseProfileHeroAvatarCluster
            reducedMotion={reducedMotion}
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
            th={th}
            isDark={isDark}
            isBusinessApproved={isBusinessApproved}
          />
          <PulseProfileHeroTitleBlock
            displayName={displayName}
            showVerified={showVerified}
            isBusinessApproved={isBusinessApproved}
            metaLine={metaLine}
            th={th}
          />
        </div>

        <PulseProfileHeroAvatarMenuRow
          open={avatarMenuOpen}
          items={avatarMenuItems}
          onOpenChange={onAvatarMenuOpenChange}
          nameSep={nameSep}
          statSep={statSep}
          th={th}
        />

        <PulseProfileHeroStatsRow
          postsCount={postsCount}
          followersCount={followersCount}
          followingCount={followingCount}
          onPostsStatClick={onPostsStatClick}
          onFollowersClick={onFollowersClick}
          onFollowingClick={onFollowingClick}
          nameSep={nameSep}
          statSep={statSep}
          showAvatarMenu={showAvatarMenu}
        />
      </div>
    </div>
  );
}
