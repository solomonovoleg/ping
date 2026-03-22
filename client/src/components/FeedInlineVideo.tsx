import { useEffect, useRef, useCallback, useState, type CSSProperties, type SyntheticEvent } from "react";
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
 * У роликов в зоне скролла поднимаем preload (быстрее старт); вне зоны — только metadata.
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
  const [preloadAhead, setPreloadAhead] = useState(false);
  const [holdSpeed, setHoldSpeed] = useState<1 | 2 | 3>(1);

  const useSeamless = !reducedMotion && seamlessLoop;
  useSeamlessVideoLoop(videoRef, { enabled: useSeamless, srcKey: src });

  const showReelsGestures = !!feedReelsInteraction && !reducedMotion;

  useReelsFeedVideoGestures(videoRef, {
    enabled: showReelsGestures,
    reducedMotion,
    onDoubleTap: () => feedReelsInteraction?.onDoubleTapFire(),
    srcKey: src,
    onHoldSpeed: (rate) => setHoldSpeed(rate),
  });

  /** За пределами экрана — не держим агрессивный буфер; в коридоре ленты — auto. */
  useEffect(() => {
    if (reducedMotion) return;
    const el = videoRef.current;
    if (!el) return;
    const root = scrollRootRef?.current ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setPreloadAhead(!!e?.isIntersecting);
      },
      { root, rootMargin: "85% 0px 85% 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src, scrollRootRef, reducedMotion]);

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
        const shouldPlay = e.isIntersecting && ratio >= 0.38;
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
    const onPause = () => setHoldSpeed(1);
    v.addEventListener("pause", onPause);
    return () => v.removeEventListener("pause", onPause);
  }, [reducedMotion, src]);

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

  const preload = preloadAhead ? "auto" : "metadata";

  const videoNode = (
    <video
      ref={setVideoRef}
      src={src}
      muted={!soundOn}
      loop={!useSeamless}
      playsInline
      className={cn(className, showReelsGestures && "cursor-pointer touch-manipulation")}
      style={style}
      preload={preload}
      onLoadedMetadata={onLoadedMetadata}
    />
  );

  if (!showReelsGestures) {
    return videoNode;
  }

  const cls = className ?? "";
  const fillParent = cls.includes("inset-0") && cls.includes("absolute");
  const collageFill = !fillParent && /\bh-full\b/.test(cls) && /\bw-full\b/.test(cls);

  return (
    <div
      className={cn(
        fillParent && "absolute inset-0 overflow-hidden",
        collageFill && "relative h-full w-full min-h-0 min-w-0",
        !fillParent && !collageFill && "relative w-full max-w-full",
      )}
    >
      {videoNode}
      {holdSpeed > 1 ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-[15px] font-bold tabular-nums text-white shadow-lg backdrop-blur-sm"
          aria-live="polite"
          aria-label={`Скорость воспроизведения ×${holdSpeed}`}
        >
          ×{holdSpeed}
        </div>
      ) : null}
    </div>
  );
}
