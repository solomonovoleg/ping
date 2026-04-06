import { useCallback, useEffect, useRef, type ReactElement, type RefCallback } from "react";
import { recordPushPostView } from "@/lib/push-feed";

type Props = {
  pushPostId: string;
  enabled: boolean;
  children: (setCardRef: RefCallback<HTMLDivElement>) => ReactElement;
};

/**
 * При появлении карточки в зоне видимости (входящий Push) один раз вызывает API учёта уникального просмотра.
 */
export function AttachPushViewRecording({ pushPostId, enabled, children }: Props) {
  const recordedRef = useRef(false);
  const disconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    recordedRef.current = false;
  }, [pushPostId]);

  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      disconnectRef.current?.();
      disconnectRef.current = null;
      if (!node || !enabled) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting || recordedRef.current) return;
          recordedRef.current = true;
          void recordPushPostView(pushPostId).catch(() => {});
        },
        { threshold: 0.35, rootMargin: "0px" },
      );
      io.observe(node);
      disconnectRef.current = () => io.disconnect();
    },
    [enabled, pushPostId],
  );

  useEffect(() => () => disconnectRef.current?.(), []);

  return children(setCardRef);
}
