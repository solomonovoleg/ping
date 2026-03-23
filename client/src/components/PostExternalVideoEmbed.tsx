import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { externalVideoProviderLabel, parseExternalVideoUrl } from "@/lib/external-video";
import { fetchLinkPreview } from "@/lib/link-preview";
import { youtubePosterUrlsFromEmbedUrl } from "@/lib/post-external-video";
import { resolveUrl } from "@/lib/api-base";
import { DURATION_NORMAL_MS, EASING_OUT, usePrefersReducedMotion } from "@/lib/motion";

type PostExternalVideoEmbedProps = {
  url: string;
  className?: string;
  /** Убрать боковые скругления у краёв карточки (как медиа в ленте). */
  flush?: boolean;
  /** Автозапуск встроенного плеера при входе карточки в зону видимости (без звука). */
  autoplayInViewport?: boolean;
};

function buildMutedAutoplayEmbedUrl(embedUrl: string): string {
  try {
    const u = new URL(embedUrl);
    u.searchParams.set("autoplay", "1");
    u.searchParams.set("mute", "1");
    u.searchParams.set("muted", "1");
    u.searchParams.set("playsinline", "1");
    return u.toString();
  } catch {
    return embedUrl;
  }
}

/**
 * Внешнее видео в посте: превью загружается только у видимой карточки (IntersectionObserver).
 * По умолчанию iframe стартует по тапу; опционально можно включить автозапуск в viewport.
 */
export function PostExternalVideoEmbed({ url, className, flush, autoplayInViewport = false }: PostExternalVideoEmbedProps) {
  const reducedMotion = usePrefersReducedMotion();
  const video = useMemo(() => parseExternalVideoUrl(url.trim()), [url]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [resolvedEmbedUrl, setResolvedEmbedUrl] = useState<string>("");
  const [ogTitle, setOgTitle] = useState<string | null>(null);
  const [ogImage, setOgImage] = useState<string | null>(null);
  /** Запрос к /api/link-preview завершён (успех или ошибка). */
  const [remotePreviewDone, setRemotePreviewDone] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);

  const embedUrl = resolvedEmbedUrl || video?.embedUrl || "";
  const canIframe = Boolean(
    embedUrl && (video?.provider !== "vk" || /[?&]hash=[a-z0-9_-]+/i.test(embedUrl)),
  );
  const ytPosters = useMemo(
    () => (video?.provider === "youtube" && video.embedUrl ? youtubePosterUrlsFromEmbedUrl(video.embedUrl) : []),
    [video],
  );
  const hasBuiltInPoster = Boolean(video?.provider === "youtube" && ytPosters.length > 0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const visible = Boolean(e?.isIntersecting);
        setIsInViewport(visible);
        if (visible) setNearViewport(true);
      },
      { rootMargin: "180px 0px", threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const supportsViewportAutoplay = Boolean(autoplayInViewport && canIframe && video);

  useEffect(() => {
    if (!supportsViewportAutoplay) return;
    setPlaying(isInViewport);
  }, [supportsViewportAutoplay, isInViewport]);

  useEffect(() => {
    if (!nearViewport || !video) return;
    if (hasBuiltInPoster) return;
    let cancelled = false;
    void fetchLinkPreview(video.watchUrl).then((data) => {
      if (cancelled) return;
      setRemotePreviewDone(true);
      if (!data) return;
      if (video.provider === "vk" && data.embedUrl) {
        setResolvedEmbedUrl(data.embedUrl);
      }
      setOgTitle(data.title);
      setOgImage(data.image);
    });
    return () => {
      cancelled = true;
    };
  }, [nearViewport, video, hasBuiltInPoster]);

  const startPlay = useCallback(() => {
    if (canIframe) setPlaying(true);
  }, [canIframe]);

  useEffect(() => {
    setPlaying(false);
    setResolvedEmbedUrl("");
    setOgTitle(null);
    setOgImage(null);
    setRemotePreviewDone(false);
    setPosterIndex(0);
  }, [url]);

  if (!video) return null;

  const label = externalVideoProviderLabel(video.provider);
  const previewSettled =
    !nearViewport ? false : hasBuiltInPoster ? true : remotePreviewDone;
  const showOgSkeleton = nearViewport && !previewSettled && !hasBuiltInPoster;
  const posterSrc = ytPosters.length > 0 ? ytPosters[Math.min(posterIndex, ytPosters.length - 1)] : ogImage ? resolveUrl(ogImage) : null;
  const showRichPlaceholder = nearViewport && previewSettled && !posterSrc;
  const titleLine = video.provider === "youtube" && !ogTitle ? null : ogTitle;
  const iframeSrc = supportsViewportAutoplay ? buildMutedAutoplayEmbedUrl(embedUrl) : embedUrl;

  return (
    <div
      ref={rootRef}
      className={cn(
        "w-full overflow-hidden border-y border-border/35 bg-black/[0.03] dark:bg-white/[0.04]",
        !flush && "sm:rounded-xl sm:border border-border/40",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative aspect-video w-full bg-black/80">
        {!playing || !canIframe ? (
          <>
            {nearViewport && posterSrc ? (
              <img
                src={posterSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={() => {
                  if (video.provider === "youtube" && posterIndex < ytPosters.length - 1) {
                    setPosterIndex((i) => i + 1);
                  } else {
                    setOgImage(null);
                  }
                }}
              />
            ) : null}
            {showRichPlaceholder ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 dark:from-neutral-950 dark:via-neutral-900 dark:to-black"
                aria-hidden
              >
                <div className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.9),transparent_52%)]" />
                <Play
                  className="relative z-[1] h-[4.5rem] w-[4.5rem] text-white/20"
                  strokeWidth={1.15}
                  aria-hidden
                />
                {!ogTitle ? (
                  <p className="relative z-[1] mt-3 max-w-[min(100%,18rem)] px-3 text-center text-[12px] font-medium leading-snug text-white/55">
                    Превью недоступно — нажмите Play
                  </p>
                ) : null}
              </div>
            ) : null}
            {showOgSkeleton ? (
              <div
                className={cn("absolute inset-0 bg-muted/50", !reducedMotion && "animate-pulse")}
                aria-hidden
              />
            ) : null}
            {!nearViewport ? (
              <div className="absolute inset-0 bg-muted/30" aria-hidden />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
            <div className="absolute left-3 top-3 rounded-md border border-white/20 bg-black/45 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/95 backdrop-blur-sm">
              {label}
            </div>
            {titleLine ? (
              <p className="absolute bottom-14 left-3 right-3 line-clamp-2 text-[14px] font-semibold leading-snug text-white drop-shadow-md">
                {titleLine}
              </p>
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
              {canIframe ? (
                <TapScaleButton
                  type="button"
                  haptic
                  onClick={startPlay}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-lg min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
                  aria-label={`Воспроизвести видео ${label}`}
                >
                  <Play className="h-7 w-7 ml-0.5" fill="currentColor" aria-hidden />
                </TapScaleButton>
              ) : (
                <TapScaleButton
                  type="button"
                  haptic
                  className="flex items-center gap-2 rounded-full bg-white/95 px-5 py-3 text-sm font-semibold text-black shadow-lg min-h-[var(--uix-touch-min)]"
                  aria-label={`Открыть видео в ${label}`}
                  onClick={() => window.open(video.watchUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  Смотреть в {label}
                </TapScaleButton>
              )
              }
            </div>
          </>
        ) : (
          <iframe
            src={iframeSrc}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            title={`Видео ${label}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/25 bg-background/80 px-3 py-2 backdrop-blur-sm">
        <span className="min-w-0 truncate text-[12px] font-medium text-muted-foreground">{label}</span>
        <a
          href={video.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary hover:underline underline-offset-2 min-h-[var(--uix-touch-min)] px-1 py-1"
          style={{ transition: `opacity ${DURATION_NORMAL_MS}ms ${EASING_OUT}` }}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Источник
        </a>
      </div>
    </div>
  );
}
