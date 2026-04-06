import { useEffect, useRef, useCallback, useState, type CSSProperties, type SyntheticEvent } from "react";
import { Play } from "lucide-react";
import { useFeedScrollRoot } from "@/contexts/FeedScrollRootContext";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useReelsFeedVideoGestures, useSeamlessVideoLoop } from "@/lib/reels-video";
import { triggerMediumHaptic, triggerSelectionHaptic } from "@/lib/capacitor-native";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { trackIseeTimeToFirstPlay } from "@/lib/isee-analytics";

export type FeedReelsInteraction = {
  /** Двойной тап по видео (например реакция 🔥). */
  onDoubleTapFire: () => void;
};

type FeedInlineVideoProps = {
  src: string;
  reelPostId?: string;
  className?: string;
  style?: CSSProperties;
  onLoadedMetadata?: (e: SyntheticEvent<HTMLVideoElement>) => void;
  /** Первый декодированный кадр готов (не metadata). */
  onFrameReady?: () => void;
  /** Если true — звук включается (остальные ролики в ленте обычно с muted). */
  soundOn?: boolean;
  /**
   * Псевдо-бесшовный цикл (seek у конца). Выкл. для превью/редакторов.
   * @default true при обычном автоплее ленты.
   */
  seamlessLoop?: boolean;
  /** Лента: двойной тап — лайк. Рилсы: двойной тап — лайк; удержание — ×2 / вверх ×3. */
  feedReelsInteraction?: FeedReelsInteraction | null;
  /** Лента: одиночный тап (короткая задержка, без второго тапа) — открыть видеоленту на этом ролике. */
  onReelsDeferredOpen?: () => void;
  /**
   * Режим вертикальной ленты рилсов: воспроизведение только с `reelsActive`,
   * без intersection-автоплея ленты постов.
   */
  variant?: "feed" | "reels";
  /** Для `variant="reels"`: этот слайд сейчас в фокусе. */
  reelsActive?: boolean;
  /** Для `variant="reels"`: прогресс 0..1 (полоска как в Reels). */
  onReelsProgress?: (ratio: number) => void;
  /**
   * Для `variant="reels"`: агрессивность буферизации (`auto` тяжелее для CPU/памяти).
   * По умолчанию `auto` для обратной совместимости.
   */
  reelsPreloadLevel?: "none" | "metadata" | "auto";
  /**
   * Пул рилсов: один и тот же инстанс меняет `src` без полного сброса элемента — не вызываем `load()` при смене URL.
   */
  reelsStableSlot?: boolean;
  /** Полноэкранные рилсы: горизонтальный свайп влево (к ленте постов). */
  reelsSwipeToFeed?: () => void;
  /** Полноэкранные рилсы: горизонтальный свайп вправо (в профиль). */
  reelsSwipeToProfile?: () => void;
  /** iSee: URL постера (JPEG/WebP) до декода видео; нативный атрибут `poster`. */
  reelPosterUrl?: string | null;
  /** iSee: комментарии/шит поверх — пауза без смены «активного» слайда. */
  reelsSuppressPlayback?: boolean;
};

/**
 * Видео в ленте: автовоспроизведение без звука при попадании в видимую область скролла.
 * Одновременно играет не больше одного ролика (остальные на паузе).
 * У роликов в зоне скролла поднимаем preload (быстрее старт); вне зоны — только metadata.
 */
export function FeedInlineVideo({
  src,
  reelPostId,
  className,
  style,
  onLoadedMetadata,
  onFrameReady,
  soundOn = false,
  seamlessLoop = true,
  feedReelsInteraction = null,
  onReelsDeferredOpen,
  variant = "feed",
  reelsActive = false,
  onReelsProgress,
  reelsPreloadLevel,
  reelsStableSlot = false,
  reelsSwipeToFeed,
  reelsSwipeToProfile,
  reelPosterUrl = null,
  reelsSuppressPlayback = false,
}: FeedInlineVideoProps) {
  const scrollRootRef = useFeedScrollRoot();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** Лента: жесты на прозрачном слое — iOS/WebView часто не отдают pointer-события с самого `<video>`. */
  const feedGestureOverlayRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [preloadAhead, setPreloadAhead] = useState(false);
  const [holdSpeed, setHoldSpeed] = useState<1 | 2 | 3>(1);
  const [playing, setPlaying] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const isReelsVariant = variant === "reels";
  const firstFramePaintedRef = useRef(false);
  /** Пока нет кадра — не оставляем голый `<video>` (чёрный прямоугольник). */
  const [reelsFrameReady, setReelsFrameReady] = useState(false);
  const [reelsMediaError, setReelsMediaError] = useState(false);
  /** Замер до первого `playing` на активном iSee-слайде (dev log + телеметрия с throttling). */
  const reelsTtfpRef = useRef<number | null>(null);

  const reelsPlaybackLive = isReelsVariant && reelsActive && !reelsSuppressPlayback;

  const useSeamless = !reducedMotion && seamlessLoop;
  useSeamlessVideoLoop(videoRef, { enabled: useSeamless, srcKey: src });

  useEffect(() => {
    if (!isReelsVariant || !reelsPlaybackLive) {
      reelsTtfpRef.current = null;
      return;
    }
    reelsTtfpRef.current = performance.now();
  }, [src, isReelsVariant, reelsPlaybackLive]);

  const showReelsGestures =
    !!feedReelsInteraction ||
    !!onReelsDeferredOpen ||
    (isReelsVariant && reelsPlaybackLive && (!!reelsSwipeToFeed || !!reelsSwipeToProfile));

  const useFeedGestureOverlay = !isReelsVariant && showReelsGestures;

  const onSingleTapDeferred = useCallback(() => {
    if (onReelsDeferredOpen) {
      onReelsDeferredOpen();
      return;
    }
    if (isReelsVariant && reelsPlaybackLive) {
      triggerSelectionHaptic();
      const v = videoRef.current;
      if (!v) return;
      // play() может быть отклонён политикой автовоспроизведения — тихий catch ожидаем.
      if (v.paused) void v.play().catch(() => {});
      else v.pause();
    }
  }, [onReelsDeferredOpen, isReelsVariant, reelsPlaybackLive]);

  useReelsFeedVideoGestures(useFeedGestureOverlay ? feedGestureOverlayRef : videoRef, {
    enabled: showReelsGestures && (!isReelsVariant || reelsPlaybackLive) && !reducedMotion,
    playbackVideoRef: isReelsVariant && reelsPlaybackLive ? videoRef : null,
    onDoubleTap: () => {
      feedReelsInteraction?.onDoubleTapFire();
    },
    srcKey: src,
    onHoldSpeed: isReelsVariant && reelsPlaybackLive ? (rate) => setHoldSpeed(rate) : undefined,
    onSingleTapDeferred:
      onReelsDeferredOpen || (isReelsVariant && reelsPlaybackLive) ? onSingleTapDeferred : undefined,
    gestureMode: isReelsVariant && reelsPlaybackLive ? "reels" : "feed",
    onSwipeLeft: isReelsVariant && reelsPlaybackLive ? reelsSwipeToFeed : undefined,
    onSwipeRight: isReelsVariant && reelsPlaybackLive ? reelsSwipeToProfile : undefined,
    onReelsHoldEngaged: isReelsVariant && reelsPlaybackLive ? () => triggerMediumHaptic() : undefined,
  });

  /** Reels: только активный слайд играет; соседи в DOM для предзагрузки. */
  useEffect(() => {
    firstFramePaintedRef.current = false;
    setFrameReady(false);
    if (isReelsVariant) {
      setReelsFrameReady(false);
      setReelsMediaError(false);
    }
  }, [src, isReelsVariant]);

  useEffect(() => {
    if (!isReelsVariant) return;
    const v = videoRef.current;
    if (!v) return;
    v.setAttribute("data-feed-autoplay", "1");
    if (reelPostId) v.setAttribute("data-reel-post-id", reelPostId);
    if (reelsPlaybackLive) v.setAttribute("data-reels-active", "1");
    else v.removeAttribute("data-reels-active");
    if (reelsPlaybackLive) {
      const scope: ParentNode = scrollRootRef?.current ?? document;
      scope.querySelectorAll("video[data-feed-autoplay]").forEach((node) => {
        if (node !== v) {
          const o = node as HTMLVideoElement;
          o.pause();
          o.playbackRate = 1;
        }
      });
      void v.play().catch(() => {});
      requestAnimationFrame(() => {
        void v.play().catch(() => {});
      });
    } else {
      v.pause();
      v.playbackRate = 1;
    }
    return () => {
      v.removeAttribute("data-feed-autoplay");
      v.removeAttribute("data-reels-active");
      v.removeAttribute("data-reel-post-id");
    };
  }, [isReelsVariant, reelsPlaybackLive, src, reelPostId, scrollRootRef]);

  /**
   * iOS / WebKit: первый `play()` часто приходит до буфера — отклоняется; после `canplay` нужен повтор.
   * Слушатели снимаем после первого `playing`, чтобы тап-пауза не «оживлялась» следующим canplay.
   */
  useEffect(() => {
    if (!isReelsVariant || !reelsPlaybackLive) return;
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    let sawPlaying = false;
    const tryPlay = () => {
      if (cancelled || sawPlaying) return;
      void v.play().catch(() => {});
    };
    const onPlaying = () => {
      sawPlaying = true;
    };
    v.addEventListener("playing", onPlaying);
    v.addEventListener("canplay", tryPlay);
    v.addEventListener("canplaythrough", tryPlay);
    v.addEventListener("loadeddata", tryPlay);
    tryPlay();
    return () => {
      cancelled = true;
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("canplaythrough", tryPlay);
      v.removeEventListener("loadeddata", tryPlay);
    };
  }, [isReelsVariant, reelsPlaybackLive, src]);

  /** WKWebView / старый iOS: явные флаги инлайн и muted до автоплея. */
  useEffect(() => {
    if (!isReelsVariant) return;
    const v = videoRef.current;
    if (!v) return;
    try {
      v.defaultMuted = !soundOn;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
    } catch {
      /* noop */
    }
  }, [isReelsVariant, soundOn, src]);

  /** Вне пула: при смене поста/слайда освобождаем декодер. */
  useEffect(() => {
    if (!isReelsVariant || reelsStableSlot) return;
    const v = videoRef.current;
    if (!v) return;
    return () => {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        /* ignore */
      }
    };
  }, [isReelsVariant, reelsStableSlot, src]);

  /** Пул рилсов: тот же `<video>` переживает смену `src`; `load()` только при уходе со страницы. */
  useEffect(() => {
    if (!isReelsVariant || !reelsStableSlot) return;
    const v = videoRef.current;
    if (!v) return;
    return () => {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        /* ignore */
      }
    };
  }, [isReelsVariant, reelsStableSlot]);

  /** Прогресс как в нативных рилсах: rAF к `currentTime` (без редкого `timeupdate`). При reduced motion — реже обновляем. */
  useEffect(() => {
    if (!isReelsVariant || !reelsPlaybackLive || !onReelsProgress) return;
    const v = videoRef.current;
    if (!v) return;
    if (reducedMotion) {
      const onTime = () => {
        const d = v.duration;
        if (!d || !Number.isFinite(d) || d <= 0) {
          onReelsProgress(0);
          return;
        }
        onReelsProgress(Math.min(1, v.currentTime / d));
      };
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("loadedmetadata", onTime);
      onTime();
      return () => {
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("loadedmetadata", onTime);
      };
    }
    let raf = 0;
    const tick = () => {
      const d = v.duration;
      if (!d || !Number.isFinite(d) || d <= 0) onReelsProgress(0);
      else onReelsProgress(Math.min(1, v.currentTime / d));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isReelsVariant, reelsPlaybackLive, onReelsProgress, reducedMotion, src]);

  /** За пределами экрана — не держим агрессивный буфер; в коридоре ленты — auto. */
  useEffect(() => {
    if (isReelsVariant) return;
    const el = videoRef.current;
    if (!el) return;
    /**
     * iOS / WKWebView: IntersectionObserver с `root` = внутренний overflow-scroll (ленты/профиля)
     * часто не шлёт callbacks при прокрутке — preload и автоплей «залипают». Implicit root = viewport надёжнее.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setPreloadAhead(!!e?.isIntersecting);
      },
      { root: null, rootMargin: "100% 0px 100% 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src, isReelsVariant]);

  useEffect(() => {
    if (isReelsVariant) return;
    const el = videoRef.current;
    if (!el) return;

    el.setAttribute("data-feed-autoplay", "1");

    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        const v = videoRef.current;
        if (!v) return;
        const ratio = e.intersectionRatio;
        const shouldPlay = e.isIntersecting && ratio >= 0.2;
        if (!shouldPlay) {
          v.pause();
          v.playbackRate = 1;
          return;
        }
        const scope: ParentNode = scrollRootRef?.current ?? document;
        scope.querySelectorAll("video[data-feed-autoplay]").forEach((node) => {
          if (node !== v) {
            const o = node as HTMLVideoElement;
            o.pause();
            o.playbackRate = 1;
          }
        });
        v.play().catch(() => {});
      },
      {
        root: null,
        rootMargin: "0px 0px -8% 0px",
        threshold: [0, 0.15, 0.3, 0.45, 0.65, 0.85, 1],
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeAttribute("data-feed-autoplay");
    };
  }, [src, scrollRootRef, isReelsVariant]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPause = () => setHoldSpeed(1);
    v.addEventListener("pause", onPause);
    return () => v.removeEventListener("pause", onPause);
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !soundOn;
    if (soundOn) {
      v.volume = 1;
      if (!isReelsVariant || reelsPlaybackLive) {
        void v.play().catch(() => {});
      }
    }
  }, [soundOn, src, isReelsVariant, reelsPlaybackLive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
  }, []);

  const preload = isReelsVariant ? (reelsPreloadLevel ?? "auto") : preloadAhead ? "auto" : "metadata";

  const ensureFirstFramePaint = useCallback(() => {
    const v = videoRef.current;
    if (!v || firstFramePaintedRef.current) return;
    if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    const safeEnd = Math.max(0, d - 0.05);
    try {
      v.currentTime = Math.min(0.001, safeEnd || 0.001);
      firstFramePaintedRef.current = true;
      setFrameReady(true);
      onFrameReady?.();
      if (isReelsVariant) setReelsFrameReady(true);
    } catch {
      /* ignore */
    }
  }, [isReelsVariant, onFrameReady]);

  const posterResolved = reelPosterUrl?.trim() ? reelPosterUrl.trim() : undefined;
  /** Priority Hints (Chrome / часть WebKit): активный слот — выше в очереди сети. */
  const videoFetchPriority = isReelsVariant
    ? reelsActive
      ? "high"
      : reelsPreloadLevel === "auto"
        ? "low"
        : "auto"
    : undefined;

  const videoNode = (
    <video
      ref={setVideoRef}
      src={src}
      poster={isReelsVariant ? posterResolved : undefined}
      data-reel-post-id={reelPostId}
      autoPlay
      muted={!soundOn}
      loop={!useSeamless}
      playsInline
      controls={false}
      className={cn(
        className,
        showReelsGestures && !useFeedGestureOverlay && "cursor-pointer touch-manipulation",
        useFeedGestureOverlay && "pointer-events-none",
      )}
      style={style}
      preload={preload}
      {...(videoFetchPriority ? { fetchPriority: videoFetchPriority } : {})}
      onLoadedMetadata={onLoadedMetadata}
      onLoadedData={ensureFirstFramePaint}
      onCanPlay={ensureFirstFramePaint}
      onPlaying={() => {
        if (!frameReady) {
          setFrameReady(true);
          onFrameReady?.();
        }
        if (isReelsVariant) {
          setReelsFrameReady(true);
          setReelsMediaError(false);
          if (reelsPlaybackLive && reelsTtfpRef.current != null) {
            const ms = Math.round(performance.now() - reelsTtfpRef.current);
            trackIseeTimeToFirstPlay({ ms, postId: reelPostId });
            reelsTtfpRef.current = null;
          }
        }
      }}
      onError={() => {
        if (isReelsVariant) setReelsMediaError(true);
      }}
    />
  );

  const retryReelsMedia = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setReelsMediaError(false);
    try {
      v.load();
      void v.play().catch(() => {});
    } catch {
      setReelsMediaError(true);
    }
  }, []);

  if (!showReelsGestures) {
    return (
      <div className="relative h-full w-full">
        {videoNode}
        {!frameReady ? (
          <div
            className="pointer-events-none absolute inset-0 z-[9] animate-pulse"
            style={{
              background:
                "linear-gradient(120deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0.1) 52%, rgba(255,255,255,0.04) 72%, rgba(255,255,255,0.08) 100%)",
            }}
            aria-hidden
          />
        ) : null}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition-opacity duration-200",
            playing && frameReady && "opacity-0"
          )}
          aria-hidden
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm">
            <Play className="ml-0.5 h-6 w-6" />
          </span>
        </div>
      </div>
    );
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
      {useFeedGestureOverlay ? (
        <div
          ref={feedGestureOverlayRef}
          className="absolute inset-0 z-[5] touch-manipulation select-none"
          aria-hidden
        />
      ) : null}
      {isReelsVariant && !reelsFrameReady && !posterResolved ? (
        <div
          className="pointer-events-none absolute inset-0 z-[6] animate-pulse"
          style={{
            background:
              "linear-gradient(120deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0.1) 52%, rgba(255,255,255,0.04) 72%, rgba(255,255,255,0.08) 100%)",
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition-opacity duration-200",
          (playing && frameReady) || (isReelsVariant && !reelsPlaybackLive) ? "opacity-0" : undefined,
        )}
        aria-hidden
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm">
          <Play className="ml-0.5 h-6 w-6" />
        </span>
      </div>
      {isReelsVariant && reelsMediaError && reelsActive ? (
        <div
          className="absolute inset-0 z-[25] flex flex-col items-center justify-center gap-3 bg-black/70 px-4 backdrop-blur-sm"
          role="alert"
        >
          <p className="text-center text-sm text-white/90">Не удалось загрузить видео</p>
          <TapScaleButton
            type="button"
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white"
            onClick={retryReelsMedia}
          >
            Повторить
          </TapScaleButton>
        </div>
      ) : null}
      {isReelsVariant && reelsPlaybackLive && holdSpeed > 1 ? (
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
