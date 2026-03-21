import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { getMediaDisplayFormat, type MediaDisplayFormat } from "@/lib/media-format";
import { getExifOrientation, shouldSwapDimensionsForOrientation } from "@/lib/exif-orientation";
import type { PostMediaLayout } from "@shared/post-media-layout";

/** Единая оболочка коллажа и одиночного медиа в ленте / профиле */
const MEDIA_TOP = "mt-[var(--uix-space-3)]";
const COLLAGE_SHELL = `${MEDIA_TOP} rounded-2xl overflow-hidden border border-border/40 bg-muted/20 shadow-sm ring-1 ring-black/[0.04]`;
const SINGLE_SHELL = `${MEDIA_TOP} rounded-2xl overflow-hidden border border-border/40 bg-muted/25 shadow-sm ring-1 ring-black/[0.04] w-full`;
/** Во всю ширину экрана (лента профиля PULSE), без скруглений у оболочки */
const PROFILE_EDGE_COLLAGE = "mt-0 w-full rounded-none overflow-hidden border-0 bg-black/[0.06] shadow-none ring-0";
const PROFILE_EDGE_SINGLE = "mt-0 w-full rounded-none overflow-hidden border-0 bg-black/20 shadow-none ring-0";
const COLLAGE_CELL = "bg-black/[0.06] flex items-center justify-center";

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(url);
}

/** Один медиа: формат по фактическому соотношению сторон (горизонт / квадрат / сториз). */
function SinglePostMedia({
  url,
  isVideo,
  forcedFormat,
  maxHeight = "min(400px, 70vh)",
  className,
  shellClassName,
}: {
  url: string;
  isVideo: boolean;
  forcedFormat?: MediaDisplayFormat | null;
  maxHeight?: string;
  className?: string;
  /** Вместо `SINGLE_SHELL` (например профиль edge-to-edge). */
  shellClassName?: string;
}) {
  const [format, setFormat] = useState<MediaDisplayFormat | null>(null);
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const exifSwapRef = useRef(false);
  const applyFormat = useCallback((w: number, h: number) => {
    const logicalW = exifSwapRef.current ? h : w;
    const logicalH = exifSwapRef.current ? w : h;
    setFormat(getMediaDisplayFormat(logicalW, logicalH));
  }, []);

  // Для смены URL сбрасываем формат; дальнейшее определение — по фактическим naturalWidth/naturalHeight.
  useEffect(() => {
    setFormat(null);
    naturalSizeRef.current = null;
    exifSwapRef.current = false;
  }, [url]);

  useEffect(() => {
    if (isVideo) return;
    let cancelled = false;
    const isLikelyJpeg = /\.(jpe?g)(\?|$)/i.test(url);
    if (!isLikelyJpeg) return;
    (async () => {
      try {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const orientation = getExifOrientation(buffer);
        exifSwapRef.current = shouldSwapDimensionsForOrientation(orientation);
        const dims = naturalSizeRef.current;
        if (dims) applyFormat(dims.w, dims.h);
      } catch {
        // Для старых внешних URL допускаем тихий fallback на naturalWidth/naturalHeight.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, isVideo, applyFormat]);

  const effectiveFormat = forcedFormat ?? format ?? "square";

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      naturalSizeRef.current = { w, h };
      applyFormat(w, h);
    },
    [applyFormat]
  );

  const onVideoLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) setFormat(getMediaDisplayFormat(w, h));
    },
    []
  );

  const isFixedAspect = effectiveFormat === "square" || effectiveFormat === "story";
  const containerClass = cn(
    shellClassName ?? SINGLE_SHELL,
    effectiveFormat === "square" && "aspect-square",
    effectiveFormat === "story" && "aspect-[9/16]",
    !format && "min-h-[120px]",
    className
  );

  /* object-contain: показываем изображение целиком, без обрезки (существующие посты влезают в формат) */
  const mediaClass = isFixedAspect
    ? "w-full h-full object-contain block"
    : "w-full h-auto object-contain block";

  if (isVideo) {
    return (
      <div className={containerClass}>
        <video
          src={url}
          controls
          playsInline
          className={mediaClass}
          style={!isFixedAspect ? { maxHeight } : undefined}
          onLoadedMetadata={onVideoLoadedMetadata}
        />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className={mediaClass}
        style={!isFixedAspect ? { maxHeight } : undefined}
        onLoad={onImageLoad}
      />
    </div>
  );
}

type PostMediaProps = {
  /** Список URL фото/видео (1–10). Как во ВКонтакте: разная сетка по количеству. */
  mediaUrls: string[];
  /** Зафиксированный layout из БД, чтобы одинаково отображалось у всех клиентов. */
  layout?: PostMediaLayout | null;
  /** Максимальная высота контейнера (одно медиа) */
  maxHeight?: string;
  className?: string;
  /** Медиа на всю ширину без боковых отступов/скруглений оболочки (карточка профиля). */
  edgeToEdge?: boolean;
};

/**
 * Медиа поста в формате ленты (как ВК):
 * 1 — во всю ширину;
 * 2 — два в ряд;
 * 3 — одно большое слева, два справа столбиком;
 * 4 — сетка 2×2;
 * 5+ — сетка 2×2 + оставшиеся, у последней ячейки оверлей «+N».
 */
export function PostMedia({
  mediaUrls,
  layout,
  maxHeight = "min(400px, 70vh)",
  className,
  edgeToEdge = false,
}: PostMediaProps) {
  if (!mediaUrls.length) return null;

  const resolved = mediaUrls.map((u) => resolveUrl(u));
  const collageShell = edgeToEdge ? PROFILE_EDGE_COLLAGE : COLLAGE_SHELL;
  const visual = resolved.filter((u) => !isAudioUrl(u));
  const audio = resolved.filter((u) => isAudioUrl(u));
  const n = visual.length;

  const renderAudioList = () => {
    if (!audio.length) return null;
    return (
      <div
        className={cn(
          edgeToEdge ? "mt-2 flex flex-col gap-[var(--uix-space-2)] px-3" : `${MEDIA_TOP} flex flex-col gap-[var(--uix-space-2)]`,
          className
        )}
      >
        {audio.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="rounded-xl border border-border/40 bg-secondary/35 px-[var(--uix-space-3)] py-[var(--uix-space-2)]"
          >
            <audio src={url} controls preload="metadata" className="w-full" />
          </div>
        ))}
      </div>
    );
  };

  if (n === 0) {
    return renderAudioList();
  }

  // Один медиа — формат по соотношению сторон (horizontal / square / story)
  if (n === 1) {
    const singleFormat =
      layout?.mode === "single"
        ? layout.format === "horizontal"
          ? "horizontal"
          : layout.format === "story"
            ? "story"
            : "square"
        : null;
    return (
      <>
        <SinglePostMedia
          url={visual[0]}
          isVideo={isVideoUrl(visual[0])}
          forcedFormat={singleFormat}
          maxHeight={maxHeight}
          className={className}
          shellClassName={edgeToEdge ? PROFILE_EDGE_SINGLE : undefined}
        />
        {renderAudioList()}
      </>
    );
  }

  const collageVariant = layout?.mode === "collage" ? layout.variant : null;

  // Два — в ряд
  if (n === 2 || collageVariant === "grid_2") {
    return (
      <>
        <div className={cn(`${collageShell} flex gap-px`, className)}>
          {visual.map((url, i) => (
            <div key={i} className={cn("flex-1 min-w-0 aspect-square", COLLAGE_CELL)}>
              {isVideoUrl(url) ? (
                <video src={url} controls className="w-full h-full object-cover" playsInline onClick={(e) => e.stopPropagation()} />
              ) : (
                <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
        {renderAudioList()}
      </>
    );
  }

  // Три — как ВК: большое слева, два справа
  if (n === 3 || collageVariant === "mosaic_3") {
    return (
      <>
        <div className={cn(`${collageShell} flex gap-px`, className)}>
          <div className={cn("w-2/3 min-w-0 aspect-[4/3]", COLLAGE_CELL)}>
            {isVideoUrl(visual[0]) ? (
              <video src={visual[0]} controls className="w-full h-full object-cover" playsInline />
            ) : (
              <img src={visual[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="w-1/3 flex flex-col gap-px">
            {[visual[1], visual[2]].map((url, i) => (
              <div key={i} className={cn("flex-1 min-h-0", COLLAGE_CELL)}>
                {isVideoUrl(url) ? (
                  <video src={url} controls className="w-full h-full object-cover" playsInline />
                ) : (
                  <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
        {renderAudioList()}
      </>
    );
  }

  // 4 — сетка 2×2
  if (n === 4 || collageVariant === "grid_4") {
    return (
      <>
        <div className={cn(`${collageShell} grid grid-cols-2 gap-px`, className)}>
          {visual.map((url, i) => (
            <div key={i} className={cn("aspect-square", COLLAGE_CELL)}>
              {isVideoUrl(url) ? (
                <video src={url} controls className="w-full h-full object-cover" playsInline />
              ) : (
                <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
        {renderAudioList()}
      </>
    );
  }

  // 5+ — два ряда по 2, затем пятая на всю ширину; при n>5 оверлей +N
  const rest = n - 5;
  return (
    <>
      <div className={cn(`${collageShell} grid grid-cols-2 gap-px`, className)}>
        {visual.slice(0, 4).map((url, i) => (
          <div key={i} className={cn("aspect-square relative", COLLAGE_CELL)}>
            {isVideoUrl(url) ? (
              <video src={url} controls className="w-full h-full object-cover" playsInline />
            ) : (
              <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            )}
          </div>
        ))}
        <div className={cn("col-span-2 aspect-[2/1] relative", COLLAGE_CELL)}>
          {isVideoUrl(visual[4]) ? (
            <video src={visual[4]} controls className="w-full h-full object-cover" playsInline />
          ) : (
            <img src={visual[4]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          )}
          {rest > 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-xl font-bold tabular-nums backdrop-blur-[1px]">
              +{rest}
            </span>
          )}
        </div>
      </div>
      {renderAudioList()}
    </>
  );
}
