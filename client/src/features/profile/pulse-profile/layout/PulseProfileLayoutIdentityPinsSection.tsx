import { memo, type ReactNode } from "react";
import { PulseProfileIdentityBlock } from "./PulseProfileIdentityBlock";
import { PulseProfilePinnedStrip } from "./PulseProfilePinnedStrip";
import type { PulseProfileMutualFollowersModel } from "./types";

type Props = {
  mutualFollowers: PulseProfileMutualFollowersModel | null;
  bio: string | null;
  linkDisplay: string | null;
  linkHref: string | null;
  businessContactPhone?: string | null;
  businessAddress?: string | null;
  actionRow: ReactNode;
  pinnedStrip: ReactNode | undefined;
  onHighlightNew?: () => void;
};

export const PulseProfileLayoutIdentityPinsSection = memo(function PulseProfileLayoutIdentityPinsSection({
  mutualFollowers,
  bio,
  linkDisplay,
  linkHref,
  businessContactPhone,
  businessAddress,
  actionRow,
  pinnedStrip,
  onHighlightNew,
}: Props) {
  return (
    <>
      <PulseProfileIdentityBlock
        mutualFollowers={mutualFollowers}
        bio={bio}
        linkDisplay={linkDisplay}
        linkHref={linkHref}
        businessContactPhone={businessContactPhone}
        businessAddress={businessAddress}
        actionRow={actionRow}
      />
      {pinnedStrip !== undefined ? pinnedStrip : <PulseProfilePinnedStrip onHighlightNew={onHighlightNew} />}
    </>
  );
});
