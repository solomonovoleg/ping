import { memo } from "react";
import { PulseProfileAddContentStrip } from "@/features/profile/pulse-profile";

type ProfileTabKey = "posts" | "saved" | "tagged";

type Props = {
  isMe: boolean;
  activeTab: ProfileTabKey;
  onCreatePost: () => void;
};

export const UserProfilePulseAddContentStripGate = memo(function UserProfilePulseAddContentStripGate({
  isMe,
  activeTab,
  onCreatePost,
}: Props) {
  if (!isMe || activeTab !== "posts") return null;
  return <PulseProfileAddContentStrip onClick={onCreatePost} disabled={false} />;
});
