import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

export function useUserProfileAvatarInteractions(args: {
  isMe: boolean;
  hasStories: boolean;
  setPulseAvatarMenuOpen: Dispatch<SetStateAction<boolean>>;
  setActiveStoryIndex: Dispatch<SetStateAction<number | null>>;
  storyFileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const avatarLongPressTimerRef = useRef<number | null>(null);
  const avatarLongPressHandledRef = useRef(false);

  const clearAvatarLongPress = useCallback(() => {
    if (avatarLongPressTimerRef.current) {
      clearTimeout(avatarLongPressTimerRef.current);
      avatarLongPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAvatarLongPress(), [clearAvatarLongPress]);

  const handleAvatarMainClick = useCallback(() => {
    args.setPulseAvatarMenuOpen(false);
    if (!args.isMe) {
      args.setActiveStoryIndex(0);
      return;
    }
    if (avatarLongPressHandledRef.current) {
      avatarLongPressHandledRef.current = false;
      return;
    }
    if (args.hasStories) {
      args.setActiveStoryIndex(0);
    } else {
      args.storyFileInputRef.current?.click();
    }
  }, [args, clearAvatarLongPress]);

  const handleAvatarPointerDownMe = useCallback(() => {
    avatarLongPressHandledRef.current = false;
    clearAvatarLongPress();
    avatarLongPressTimerRef.current = window.setTimeout(() => {
      avatarLongPressHandledRef.current = true;
      args.storyFileInputRef.current?.click();
    }, 420);
  }, [args, clearAvatarLongPress]);

  return {
    clearAvatarLongPress,
    handleAvatarMainClick,
    handleAvatarPointerDownMe,
  };
}
