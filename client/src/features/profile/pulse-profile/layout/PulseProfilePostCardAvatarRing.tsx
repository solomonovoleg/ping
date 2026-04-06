import { memo } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { PULSE_IG_GRAD } from "../pulse-profile-theme";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  authorSeed: string;
  surfaceBg: string;
  insetBorder: string;
};

export const PulseProfilePostCardAvatarRing = memo(function PulseProfilePostCardAvatarRing({
  displayName,
  avatarUrl,
  authorSeed,
  surfaceBg,
  insetBorder,
}: Props) {
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div
        className="absolute rounded-[14px]"
        style={{
          inset: -2,
          background: PULSE_IG_GRAD,
          opacity: 0.92,
          boxShadow: "0 0 10px rgba(214,41,118,0.25)",
        }}
      />
      <div
        className="relative h-full w-full overflow-hidden rounded-xl"
        style={{ background: surfaceBg, boxShadow: `inset 0 0 0 1px ${insetBorder}` }}
      >
        <UserAvatar
          avatarUrl={avatarUrl ?? undefined}
          displayName={displayName}
          seed={authorSeed}
          size={36}
          className="h-full w-full rounded-[12px] object-cover"
        />
      </div>
    </div>
  );
});
