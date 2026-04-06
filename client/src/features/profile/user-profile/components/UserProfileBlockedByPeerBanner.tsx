import { memo } from "react";
import { BlockedByPeerComposer } from "@/features/user-blocking";

type Props = {
  note: string | null | undefined;
};

export const UserProfileBlockedByPeerBanner = memo(function UserProfileBlockedByPeerBanner({ note }: Props) {
  return (
    <div className="relative z-[1] shrink-0 px-3 pt-2">
      <BlockedByPeerComposer
        note={note}
        className="rounded-2xl border border-border/50 bg-muted/20 px-3 py-3 text-center text-sm text-muted-foreground"
      />
    </div>
  );
});
