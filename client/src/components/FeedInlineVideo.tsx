import { useEffect, useRef, useCallback, type CSSProperties, type SyntheticEvent } from "react";
import { useFeedScrollRoot } from "@/contexts/FeedScrollRootContext";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useReelsFeedVideoGestures, useSeamlessVideoLoop } from "@/lib/reels-video";
import { cn } from "@/lib/utils";

export type FeedReelsInteraction = {
  /** Двойной тап по видео (например реакция 🔥). */
  onDoubleTapFire: () => void;
};

type FeedInlineVideoProps = {
  src: string;
  className?: string;
  style?: CSSProperties;
  onLoadedMetadata?: (e: SyntheticEvent<HTMLVideoElement>) => void;
  /** Если true — звук включается (остальные ролики в ленте обычно с muted). */
  soundOn?: boolean;
  /**
   * Псевдо-бесшовный цикл (seek у конца). Выкл. для превью/редакторов.
   * @default true при обычном автоплее ленты.
   */
  seamlessLoop?: boolean;
  /** Жесты рилсов: двойной тап, удержание ×2 / вверх ×3. */
  feedReelsInteraction?: FeedReelsInteraction | null;
};

/**
 * Видео в ленте: автовоспроизведение без звука при попадании в видимую область скролла.
 * Одновременно играет не больше одного ролика (остальные на паузе).
 */
export function FeedInlineVideo({
  src,
  className,
  style,
  onLoadedMetadata,
  soundOn = false,
  seamlessLoop = true,
  feedReelsInteraction = null,
}: FeedInlineVideoProps) {
  const scrollRootRef = useFeedScrollRoot();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const useSeamless = !reducedMotion && seamlessLoop;
  useSeamlessVideoLoop(videoRef, { enabled: useSeamless, srcKey: src });

  useReelsFeedVideoGestures(videoRef, {
    enabled: !!feedReelsInteraction && !reducedMotion,
    reducedMotion,
    onDoubleTap: () => feedReelsInteraction?.onDoubleTapFire(),
    srcKey: src,
  });

  useEffect(() => {
    if (reducedMotion) return;
    const el = videoRef.current;
    if (!el) return;

    el.setAttribute("data-feed-autoplay", "1");
    const root = scrollRootRef?.current ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        const v = videoRef.current;
        if (!v) return;
        const ratio = e.intersectionRatio;
        const shouldPlay = e.isIntersecting && ratio >= 0.42;
        if (!shouldPlay) {
          v.pause();
          v.playbackRate = 1;
          return;
        }
        document.querySelectorAll("video[data-feed-autoplay]").forEach((node) => {
          if (node !== v) {
            const o = node as HTMLVideoElement;
            o.pause();
            o.playbackRate = 1;
          }
        });
        v.play().catch(() => {});
      },
      {
        root,
        rootMargin: "0px 0px -8% 0px",
        threshold: [0, 0.25, 0.45, 0.65, 0.85, 1],
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeAttribute("data-feed-autoplay");
    };
  }, [src, scrollRootRef, reducedMotion]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reducedMotion) return;
    v.muted = !soundOn;
  }, [soundOn, reducedMotion, src]);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
  }, []);

  if (reducedMotion) {
    return (
      <video
        ref={setVideoRef}
        src={src}
        controls
        playsInline
        className={cn(className)}
        style={style}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
      />
    );
  }

  return (
    <video
      ref={setVideoRef}
      src={src}
      muted={!soundOn}
      loop={!useSeamless}
      playsInline
      className={cn(className, feedReelsInteraction && "cursor-pointer touch-manipulation")}
      style={style}
      preload="metadata"
      onLoadedMetadata={onLoadedMetadata}
    />
  );
}
