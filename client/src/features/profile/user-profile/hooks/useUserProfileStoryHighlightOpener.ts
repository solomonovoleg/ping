import { useCallback, type RefObject } from "react";

/** Один обработчик для кольца «новая сториз» в шапке и в закреплённом блоке (не кликает во время публикации). */
export function useUserProfileStoryHighlightOpener(
  isMe: boolean,
  addingStory: boolean,
  storyFileInputRef: RefObject<HTMLInputElement | null>,
): (() => void) | undefined {
  const open = useCallback(() => {
    if (!addingStory) storyFileInputRef.current?.click();
  }, [addingStory, storyFileInputRef]);
  return isMe ? open : undefined;
}
