import { memo, type ComponentProps } from "react";
import { ProfilePinsSection } from "./profile-pins/ProfilePinsSection";

type Props = ComponentProps<typeof ProfilePinsSection>;

export const UserProfilePulsePinnedStrip = memo(function UserProfilePulsePinnedStrip(props: Props) {
  return <ProfilePinsSection {...props} />;
});
