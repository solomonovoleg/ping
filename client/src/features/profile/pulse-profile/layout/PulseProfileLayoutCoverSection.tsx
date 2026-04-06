import { memo } from "react";
import { PULSE_PROFILE_COVER_HEIGHT_PX } from "./constants";
import { PulseProfileCoverHeader } from "./PulseProfileCoverHeader";

type Props = {
  coverUrl: string | null;
  onCoverError: () => void;
  scrollY: number;
  usernamePill: string;
  onUsernamePillPress?: () => void;
  onBack: () => void;
  onMore: () => void;
};

export const PulseProfileLayoutCoverSection = memo(function PulseProfileLayoutCoverSection({
  coverUrl,
  onCoverError,
  scrollY,
  usernamePill,
  onUsernamePillPress,
  onBack,
  onMore,
}: Props) {
  return (
    <div className="relative w-full shrink-0" style={{ height: PULSE_PROFILE_COVER_HEIGHT_PX }}>
      <PulseProfileCoverHeader
        coverUrl={coverUrl}
        onCoverError={onCoverError}
        scrollY={scrollY}
        usernamePill={usernamePill}
        onUsernamePillPress={onUsernamePillPress}
        onBack={onBack}
        onMore={onMore}
      />
    </div>
  );
});
