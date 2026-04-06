import { memo, type ReactNode } from "react";
import { PulseProfilePostCardAvatarRing } from "./PulseProfilePostCardAvatarRing";
import { PulseProfilePostCardHeaderMeta } from "./PulseProfilePostCardHeaderMeta";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  authorSeed: string;
  surfaceBg: string;
  insetBorder: string;
  showVerified?: boolean;
  metaKind: string | null;
  metaTime: string;
  textColor: string;
  accent: string;
  headerRight?: ReactNode;
};

export const PulseProfilePostCardHeader = memo(function PulseProfilePostCardHeader({
  displayName,
  avatarUrl,
  authorSeed,
  surfaceBg,
  insetBorder,
  showVerified,
  metaKind,
  metaTime,
  textColor,
  accent,
  headerRight,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <PulseProfilePostCardAvatarRing
          displayName={displayName}
          avatarUrl={avatarUrl}
          authorSeed={authorSeed}
          surfaceBg={surfaceBg}
          insetBorder={insetBorder}
        />
        <PulseProfilePostCardHeaderMeta
          displayName={displayName}
          showVerified={showVerified}
          metaKind={metaKind}
          metaTime={metaTime}
          textColor={textColor}
          accent={accent}
        />
      </div>
      {headerRight ? (
        <div
          className="flex shrink-0 items-start gap-0.5 pt-0.5 [&_svg]:text-current"
          style={{ color: textColor }}
        >
          {headerRight}
        </div>
      ) : null}
    </div>
  );
});
