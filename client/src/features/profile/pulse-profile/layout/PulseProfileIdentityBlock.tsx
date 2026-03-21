import type { ReactNode } from "react";
import { Link } from "lucide-react";
import { usePulseProfileTheme } from "../pulse-profile-theme";
import { PulseProfileMutualFollowersRow } from "./PulseProfileMutualFollowersRow";
import type { PulseProfileMutualFollowersModel } from "./types";
import { PULSE_BODY_AFTER_CARD_PT } from "./constants";

/** Блок под карточкой героя: общие подписчики, био, ссылка, действия (имя и мета — внутри `PulseProfileHeroCard`). */
export function PulseProfileIdentityBlock({
  mutualFollowers,
  bio,
  linkDisplay,
  linkHref,
  actionRow,
}: {
  mutualFollowers: PulseProfileMutualFollowersModel | null;
  bio: string | null;
  linkDisplay: string | null;
  linkHref: string | null;
  actionRow: ReactNode;
}) {
  const { th } = usePulseProfileTheme();
  return (
    <div className="px-4" style={{ paddingTop: PULSE_BODY_AFTER_CARD_PT }}>
      {mutualFollowers && mutualFollowers.count > 0 ? (
        <PulseProfileMutualFollowersRow data={mutualFollowers} />
      ) : null}

      {bio ? (
        <p
          style={{
            fontSize: 14,
            color: th.textSub,
            lineHeight: 1.55,
            marginTop: mutualFollowers && mutualFollowers.count > 0 ? 11 : 0,
            fontWeight: 400,
          }}
        >
          {bio}
        </p>
      ) : null}
      {linkDisplay && linkHref ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1.5 break-all"
        >
          <Link style={{ width: 12, height: 12, color: th.accent, flexShrink: 0 }} aria-hidden />
          <span style={{ fontSize: 12.5, color: th.accent, fontWeight: 600 }}>{linkDisplay}</span>
        </a>
      ) : null}

      <div className="mt-4">{actionRow}</div>
    </div>
  );
}
