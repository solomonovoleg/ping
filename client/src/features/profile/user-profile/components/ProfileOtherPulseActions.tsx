import type { ReactNode } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { usePulseProfileTheme } from "@/features/profile/pulse-profile";
import { userProfileRu } from "../i18n.ru";

export function ProfileOtherPulseActions({
  isFollowing,
  isMutualFollow,
  followLoading,
  onFollow,
  onMessage,
  canMessage,
  middle,
}: {
  isFollowing: boolean;
  isMutualFollow?: boolean;
  followLoading: boolean;
  onFollow: () => void;
  onMessage: () => void;
  canMessage: boolean;
  /** Компактный слот между «Подписаться» и «Написать» (например Push-лента) */
  middle?: ReactNode;
}) {
  const { th } = usePulseProfileTheme();
  const f = userProfileRu.follow;
  const showMutual = isFollowing && isMutualFollow;
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onFollow}
        disabled={followLoading}
        className="flex h-11 min-h-[var(--uix-touch-min)] flex-1 items-center justify-center gap-1.5 rounded-2xl active:scale-[0.98] transition-all duration-150 disabled:opacity-60"
        style={{
          background: isFollowing ? `${th.accent}18` : th.accentDim,
          border: `1px solid ${isFollowing ? th.accent : th.accentBorder}`,
        }}
      >
        {followLoading ? null : isFollowing ? (
          <UserCheck className="h-4 w-4 shrink-0" style={{ color: th.accent }} strokeWidth={2.5} aria-hidden />
        ) : (
          <UserPlus className="h-4 w-4 shrink-0" style={{ color: th.accent }} strokeWidth={2.25} aria-hidden />
        )}
        <span style={{ fontSize: 13, lineHeight: 1.1, fontWeight: 700, color: isFollowing ? th.accent : th.accent }}>
          {followLoading ? f.loading : showMutual ? f.mutualLabel : isFollowing ? f.followingLabel : f.follow}
        </span>
      </button>
      {middle}
      <button
        type="button"
        onClick={onMessage}
        disabled={!canMessage}
        className="flex h-11 min-h-[var(--uix-touch-min)] flex-1 items-center justify-center rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
        style={{ background: th.surface, border: `1px solid ${th.border}` }}
      >
        <span style={{ fontSize: 13, lineHeight: 1.1, fontWeight: 600, color: th.text }}>{f.message}</span>
      </button>
    </div>
  );
}
