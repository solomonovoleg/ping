import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

export function useUserProfileUiEffects(args: {
  hasInvalidRouteId: boolean;
  setLocation: (path: string) => void;
  isMe: boolean;
  ownCoverUrl?: string | null;
  otherCoverUrl?: string | null;
  setCoverLoadError: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    if (args.hasInvalidRouteId) args.setLocation("/posts");
  }, [args.hasInvalidRouteId, args.setLocation]);

  useEffect(() => {
    args.setCoverLoadError(false);
  }, [args.isMe, args.ownCoverUrl, args.otherCoverUrl, args.setCoverLoadError]);
}
