import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { getMediaDisplayFormat, type MediaDisplayFormat } from "@/lib/media-format";

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/** Один медиа: формат по фактическому соотношению сторон (горизонт / квадрат / сториз). */
function SinglePostMedia({
  url,
  isVideo,
  maxHeight = "min(400px, 70vh)",
  className,
}: {
  url: string;
  isVideo: boolean;
  maxHeight?: string;
  className?: string;
}) {
  const [format, setFormat] = useState<MediaDisplayFormat | null>(null);
  const applyFormat = useCallback((w: number, h: number) => {
    setFormat(getMediaDisplayFormat(w, h));
  }, []);

  // Для смены URL сбрасываем формат; дальнейшее определение — по фактическим naturalWidth/naturalHeight.
  useEffect(() => {
    setFormat(null);
  }, [url]);

  const effectiveFormat = format ?? "square";

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
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
    "mt-3 rounded-lg overflow-hidden bg-muted/30 w-full",
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
  /** Максимальная высота контейнера (одно медиа) */
  maxHeight?: string;
  className?: string;
};

/**
 * Медиа поста в формате ленты (как ВК):
 * 1 — во всю ширину;
 * 2 — два в ряд;
 * 3 — одно большое слева, два справа столбиком;
 * 4 — сетка 2×2;
 * 5+ — сетка 2×2 + оставшиеся, у последней ячейки оверлей «+N».
 */
export function PostMedia({ mediaUrls, maxHeight = "min(400px, 70vh)", className }: PostMediaProps) {
  if (!mediaUrls.length) return null;

  const resolved = mediaUrls.map((u) => resolveUrl(u));
  const n = resolved.length;

  // Один медиа — формат по соотношению сторон (horizontal / square / story)
  if (n === 1) {
    return (
      <SinglePostMedia
        url={resolved[0]}
        isVideo={isVideoUrl(resolved[0])}
        maxHeight={maxHeight}
        className={className}
      />
    );
  }

  // Два — в ряд
  if (n === 2) {
    return (
      <div className={cn("mt-3 rounded-2xl overflow-hidden border border-border/50 flex gap-px", className)}>
        {resolved.map((url, i) => (
          <div key={i} className="flex-1 min-w-0 aspect-square bg-black/5 flex items-center justify-center">
            {isVideoUrl(url) ? (
              <video src={url} controls className="w-full h-full object-cover" playsInline onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Три — как ВК: большое слева, два справа
  if (n === 3) {
    return (
      <div className={cn("mt-3 rounded-2xl overflow-hidden border border-border/50 flex gap-px", className)}>
        <div className="w-2/3 min-w-0 aspect-[4/3] bg-black/5 flex items-center justify-center">
          {isVideoUrl(resolved[0]) ? (
            <video src={resolved[0]} controls className="w-full h-full object-cover" playsInline />
          ) : (
            <img src={resolved[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="w-1/3 flex flex-col gap-px">
          {[resolved[1], resolved[2]].map((url, i) => (
            <div key={i} className="flex-1 min-h-0 bg-black/5 flex items-center justify-center">
              {isVideoUrl(url) ? (
                <video src={url} controls className="w-full h-full object-cover" playsInline />
              ) : (
                <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 — сетка 2×2
  if (n === 4) {
    return (
      <div className={cn("mt-3 rounded-2xl overflow-hidden border border-border/50 grid grid-cols-2 gap-px", className)}>
        {resolved.map((url, i) => (
          <div key={i} className="aspect-square bg-black/5 flex items-center justify-center">
            {isVideoUrl(url) ? (
              <video src={url} controls className="w-full h-full object-cover" playsInline />
            ) : (
              <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // 5+ — два ряда по 2, затем пятая на всю ширину; при n>5 оверлей +N
  const rest = n - 5;
  return (
    <div className={cn("mt-3 rounded-2xl overflow-hidden border border-border/50 grid grid-cols-2 gap-px", className)}>
      {resolved.slice(0, 4).map((url, i) => (
        <div key={i} className="aspect-square bg-black/5 flex items-center justify-center relative">
          {isVideoUrl(url) ? (
            <video src={url} controls className="w-full h-full object-cover" playsInline />
          ) : (
            <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          )}
        </div>
      ))}
      <div className="col-span-2 aspect-[2/1] bg-black/5 flex items-center justify-center relative">
        {isVideoUrl(resolved[4]) ? (
          <video src={resolved[4]} controls className="w-full h-full object-cover" playsInline />
        ) : (
          <img src={resolved[4]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        )}
        {rest > 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-2xl font-bold">
            +{rest}
          </span>
        )}
      </div>
    </div>
  );
}
