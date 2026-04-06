import type { ReactNode } from "react";
import { usePulseProfileTheme } from "../pulse-profile-theme";
import type { PulseProfileMutualFollowersModel } from "./types";
import { PULSE_BODY_AFTER_CARD_PT } from "./constants";
import { pulseProfileIdentityBioMarginTopPx } from "./pulse-profile-identity-spacing";
import { PulseProfileIdentityActionSlot } from "./PulseProfileIdentityActionSlot";
import { PulseProfileIdentityBio } from "./PulseProfileIdentityBio";
import { PulseProfileBusinessContactsCard } from "./PulseProfileBusinessContactsCard";
import { PulseProfileIdentityExternalLink } from "./PulseProfileIdentityExternalLink";
import { PulseProfileIdentityMutualGate } from "./PulseProfileIdentityMutualGate";

/** Блок под карточкой героя: общие подписчики, био, ссылка, действия (имя и мета — внутри `PulseProfileHeroCard`). */
export function PulseProfileIdentityBlock({
  mutualFollowers,
  bio,
  linkDisplay,
  linkHref,
  businessContactPhone,
  businessAddress,
  actionRow,
}: {
  mutualFollowers: PulseProfileMutualFollowersModel | null;
  bio: string | null;
  linkDisplay: string | null;
  linkHref: string | null;
  businessContactPhone?: string | null;
  businessAddress?: string | null;
  actionRow: ReactNode;
}) {
  const { th } = usePulseProfileTheme();
  const showMutualRow = !!(mutualFollowers && mutualFollowers.count > 0);
  const bioMarginTop = pulseProfileIdentityBioMarginTopPx(showMutualRow);

  return (
    <div className="px-4" style={{ paddingTop: PULSE_BODY_AFTER_CARD_PT }}>
      <PulseProfileIdentityMutualGate data={mutualFollowers} />

      {bio ? (
        <PulseProfileIdentityBio text={bio} textColor={th.text} marginTop={bioMarginTop} />
      ) : null}

      {linkDisplay && linkHref ? (
        <PulseProfileIdentityExternalLink linkDisplay={linkDisplay} linkHref={linkHref} accent={th.accent} />
      ) : null}

      <PulseProfileBusinessContactsCard
        phone={businessContactPhone ?? null}
        address={businessAddress ?? null}
        accent={th.accent}
      />

      <PulseProfileIdentityActionSlot>{actionRow}</PulseProfileIdentityActionSlot>
    </div>
  );
}
