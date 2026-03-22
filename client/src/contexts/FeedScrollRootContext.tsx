import { createContext, useContext, type RefObject } from "react";

/** Скролл-контейнер ленты — для IntersectionObserver у встроенных видео */
export const FeedScrollRootContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useFeedScrollRoot(): RefObject<HTMLElement | null> | null {
  return useContext(FeedScrollRootContext);
}
