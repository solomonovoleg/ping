import { createContext, useContext, type RefObject } from "react";

/** Скролл-контейнер ленты — для паузы «чужих» inline-видео в одном scope; IO смотрит viewport (iOS/WKWebView). */
export const FeedScrollRootContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useFeedScrollRoot(): RefObject<HTMLElement | null> | null {
  return useContext(FeedScrollRootContext);
}
