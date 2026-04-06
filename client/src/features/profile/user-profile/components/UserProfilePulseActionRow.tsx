import { memo, type ReactNode } from "react";
import { ProfileMePulseActions } from "./ProfileMePulseActions";
import { ProfileOtherPulseActions } from "./ProfileOtherPulseActions";

type OtherProfileSlice = {
  isFollowing: boolean;
  isMutualFollow: boolean;
  canMessage: boolean;
};

type Props = {
  isMe: boolean;
  onOpenAnalytics: () => void;
  onEditProfile: () => void;
  onCopyLink: () => void;
  otherProfile: OtherProfileSlice | null;
  followLoading: boolean;
  onFollowToggle: () => void;
  onStartChat: () => void;
  /** Слот между кнопками подписки и сообщения (чужой профиль) */
  pushMiddleSlot?: ReactNode;
};

export const UserProfilePulseActionRow = memo(function UserProfilePulseActionRow({
  isMe,
  onOpenAnalytics,
  onEditProfile,
  onCopyLink,
  otherProfile,
  followLoading,
  onFollowToggle,
  onStartChat,
  pushMiddleSlot,
}: Props) {
  if (isMe) {
    return (
      <ProfileMePulseActions onEdit={onEditProfile} onShare={onCopyLink} onStats={onOpenAnalytics} />
    );
  }
  const o = otherProfile;
  return (
    <ProfileOtherPulseActions
      isFollowing={!!o?.isFollowing}
      isMutualFollow={!!o?.isMutualFollow}
      followLoading={followLoading}
      onFollow={onFollowToggle}
      onMessage={onStartChat}
      canMessage={!!o?.canMessage}
      middle={pushMiddleSlot}
    />
  );
});
