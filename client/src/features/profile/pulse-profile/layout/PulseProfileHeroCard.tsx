import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import { usePulseProfileTheme } from "../pulse-profile-theme";
import {
  PULSE_AVATAR_PX,
  PULSE_AVATAR_SQUIRCLE_RX,
  PULSE_PROFILE_CARD_OVERLAP_PX,
} from "./constants";
import { StatCounter } from "./StatCounter";
import { StoryRing } from "./StoryRing";

export function PulseProfileHeroCard({
  coverInScrollFlow = true,
  reducedMotion,
  displayName,
  showVerified,
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
  const statSep = isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.1)";
  const nameSep = isDark ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.09)";

  return (
    <div
      className={coverInScrollFlow ? "relative z-10 mx-3 mb-1" : "relative z-30 mx-3 mb-1"}
      style={{ marginTop: coverInScrollFlow ? -PULSE_PROFILE_CARD_OVERLAP_PX : 0 }}
    >
      <div
        className="rounded-3xl px-4 py-4"
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
        <div className="flex items-center gap-4">
          <div
            className="relative shrink-0"
            style={{
              width: PULSE_AVATAR_PX,
              height: PULSE_AVATAR_PX,
              animation: reducedMotion ? undefined : "pulse-profile-avatar-float 4s ease-in-out infinite",
            }}
          >
            {hasStoryGradient ? <StoryRing size={PULSE_AVATAR_PX} /> : null}
            <button
              type="button"
              onClick={onAvatarPress}
              onPointerDown={onAvatarPointerDown}
              onPointerUp={onAvatarPointerUp}
              onPointerLeave={onAvatarPointerLeave}
              onPointerCancel={onAvatarPointerCancel}
              onContextMenu={onAvatarContextMenu}
              className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden transition-transform active:scale-95"
              style={{
                borderRadius: PULSE_AVATAR_SQUIRCLE_RX,
                background: isDark
                  ? "linear-gradient(145deg,#1e1535,#0f0c1f)"
                  : "linear-gradient(145deg,#ede9fe,#fafafa)",
                border: `2px solid ${isDark ? `${th.accent}40` : `${th.accent}30`}`,
                color: th.accent,
              }}
              aria-label="Аватар и сториз"
            >
              {avatarInner}
            </button>
            {showAvatarPlus ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAvatarPlusClick();
                }}
                className="absolute z-30 flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full transition-all active:scale-90"
                style={{
                  width: 22,
                  height: 22,
                  bottom: 0,
                  right: 0,
                  background: isDark ? "#1a1a2e" : "#ffffff",
                  border: `2px solid ${isDark ? "rgba(18,18,30,0.92)" : "rgba(255,255,255,0.92)"}`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
                aria-label="Меню аватара"
              >
                <Plus style={{ width: 11, height: 11, color: th.accent, strokeWidth: 2.5 }} />
              </button>
            ) : null}

          </div>

          <div className="flex min-w-0 flex-1">
            <div
              className="min-w-0 flex-1"
              style={{
                borderRight: `1px solid ${statSep}`,
              }}
            >
              <StatCounter target={postsCount} label="Посты" onClick={onPostsStatClick} />
            </div>
            <div
              className="min-w-0 flex-1"
              style={{
                borderRight: `1px solid ${statSep}`,
              }}
            >
              <StatCounter target={followersCount} label="Подписчики" onClick={onFollowersClick} />
            </div>
            <div className="min-w-0 flex-1">
              <StatCounter target={followingCount} label="Подписки" onClick={onFollowingClick} />
            </div>
          </div>
        </div>

        {avatarMenuOpen && avatarMenuItems.length > 0 ? (
          <div
            className="mt-3 flex flex-row flex-nowrap items-stretch border-t pt-3"
            style={{ borderColor: nameSep }}
            role="menu"
          >
            {avatarMenuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  onAvatarMenuOpenChange(false);
                  item.onClick();
                }}
                className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 basis-0 border-l px-1 py-2 text-center text-[11px] font-semibold leading-[1.2] transition-opacity first:border-l-0 active:opacity-75"
                style={{
                  color: th.text,
                  borderColor: statSep,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          style={{
            marginTop: avatarMenuOpen && avatarMenuItems.length > 0 ? 12 : 16,
            paddingTop: 14,
            borderTop: `1px solid ${nameSep}`,
          }}
        >
          <div className="flex items-center gap-1.5">
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: th.text,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              {displayName}
            </h1>
            {showVerified ? (
              <div
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{ width: 18, height: 18, background: th.accent, marginTop: 1 }}
                aria-label="Подтверждённый профиль"
              >
                <span style={{ fontSize: 9.5, color: "white", fontWeight: 900 }}>✓</span>
              </div>
            ) : null}
          </div>
          {metaLine ? (
            <p
              style={{
                fontSize: 12.5,
                color: th.text,
                marginTop: 5,
                fontWeight: 400,
                letterSpacing: "0.01em",
              }}
            >
              {metaLine}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
