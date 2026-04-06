import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { memo } from "react";
import { Plus } from "lucide-react";
import type { buildPulseProfileTheme } from "../pulse-profile-theme";
import {
  PULSE_AVATAR_PX,
  PULSE_AVATAR_PLUS_BADGE_PX,
  PULSE_AVATAR_PLUS_CONTAINER_OFFSET_PX,
  PULSE_AVATAR_PLUS_HIT_PX,
  PULSE_AVATAR_SQUIRCLE_RX,
} from "./constants";
import { StoryRing } from "./StoryRing";

type Th = ReturnType<typeof buildPulseProfileTheme>;

type Props = {
  reducedMotion: boolean;
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
  th: Th;
  isDark: boolean;
  isBusinessApproved?: boolean;
};

export const PulseProfileHeroAvatarCluster = memo(function PulseProfileHeroAvatarCluster({
  reducedMotion,
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
  th,
  isDark,
  isBusinessApproved = false,
}: Props) {
  return (
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
          border: isBusinessApproved
            ? `2px solid ${isDark ? "rgba(245,158,11,0.72)" : "rgba(217,119,6,0.62)"}`
            : `2px solid ${isDark ? `${th.accent}40` : `${th.accent}30`}`,
          boxShadow: isBusinessApproved
            ? isDark
              ? "0 0 0 1px rgba(245,158,11,0.25), 0 8px 20px rgba(245,158,11,0.22)"
              : "0 0 0 1px rgba(217,119,6,0.2), 0 6px 16px rgba(245,158,11,0.18)"
            : undefined,
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
          className="absolute z-30 flex items-end justify-end border-0 bg-transparent p-0 transition-transform active:scale-90"
          style={{
            width: PULSE_AVATAR_PLUS_HIT_PX,
            height: PULSE_AVATAR_PLUS_HIT_PX,
            bottom: -PULSE_AVATAR_PLUS_CONTAINER_OFFSET_PX,
            right: -PULSE_AVATAR_PLUS_CONTAINER_OFFSET_PX,
          }}
          aria-label="Меню аватара"
        >
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: PULSE_AVATAR_PLUS_BADGE_PX,
              height: PULSE_AVATAR_PLUS_BADGE_PX,
              marginBottom: (PULSE_AVATAR_PLUS_HIT_PX - PULSE_AVATAR_PLUS_BADGE_PX) / 2,
              marginRight: (PULSE_AVATAR_PLUS_HIT_PX - PULSE_AVATAR_PLUS_BADGE_PX) / 2,
              background: isDark ? "#1a1a2e" : "#ffffff",
              border: `1.5px solid ${isDark ? "rgba(18,18,30,0.92)" : "rgba(255,255,255,0.92)"}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.28)",
            }}
          >
            <Plus
              style={{
                width: 12,
                height: 12,
                color: th.accent,
                strokeWidth: 2.75,
              }}
              aria-hidden
            />
          </span>
        </button>
      ) : null}
    </div>
  );
});
