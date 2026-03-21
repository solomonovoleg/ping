import { usePulseProfileTheme } from "@/features/profile/pulse-profile";
import { userProfileRu } from "../i18n.ru";

export function ProfileOtherPulseActions({
  isFollowing,
  followLoading,
  onFollow,
  onMessage,
  canMessage,
}: {
  isFollowing: boolean;
  followLoading: boolean;
  onFollow: () => void;
  onMessage: () => void;
  canMessage: boolean;
}) {
  const { th } = usePulseProfileTheme();
  const f = userProfileRu.follow;
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onFollow}
        disabled={followLoading}
        className="flex-1 flex items-center justify-center rounded-2xl min-h-[var(--uix-touch-min)] active:scale-[0.98] transition-transform disabled:opacity-60"
        style={{
          height: 40,
          background: isFollowing ? th.surface : th.accentDim,
          border: `1px solid ${isFollowing ? th.border : th.accentBorder}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: isFollowing ? th.text : th.accent }}>
          {followLoading ? f.loading : isFollowing ? f.followingLabel : f.follow}
        </span>
      </button>
      <button
        type="button"
        onClick={onMessage}
        disabled={!canMessage}
        className="flex-1 flex items-center justify-center rounded-2xl min-h-[var(--uix-touch-min)] active:scale-[0.98] transition-transform disabled:opacity-50"
        style={{ height: 40, background: th.surface, border: `1px solid ${th.border}` }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{f.message}</span>
      </button>
    </div>
  );
}
