import { useState, useEffect, type CSSProperties, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import type { PostMediaLayout } from "@shared/post-media-layout";
import { FeedInlineVideo, type FeedReelsInteraction } from "@/components/FeedInlineVideo";
import { getMediaDisplayFormat, getFeedSingleCropAspectRatio } from "@/lib/media-format";

/** Единая оболочка коллажа и одиночного медиа в ленте / профиле */
const MEDIA_TOP = "mt-[var(--uix-space-3)]";
const COLLAGE_SHELL = `${MEDIA_TOP} rounded-2xl overflow-hidden border border-border/40 bg-muted/20 shadow-sm ring-1 ring-black/[0.04]`;
const SINGLE_SHELL = `${MEDIA_TOP} rounded-2xl overflow-hidden border border-border/40 bg-muted/25 shadow-sm ring-1 ring-black/[0.04] w-full`;
/** Во всю ширину экрана (лента / профиль PULSE), без боковых отступов и скруглений оболочки */
const PROFILE_EDGE_COLLAGE = "mt-0 w-full rounded-none overflow-hidden border-0 bg-black shadow-none ring-0";
const PROFILE_EDGE_SINGLE = "mt-0 w-full rounded-none overflow-hidden border-0 bg-black shadow-none ring-0";
const COLLAGE_CELL = "bg-black/[0.06] flex items-center justify-center";
const COLLAGE_CELL_EDGE = "bg-black flex items-center justify-center";

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(url);
}

/**
 * Одно медиа:
 * - **cropCover** (лента/профиль full-bleed): после загрузки — один из трёх слотов (1:1 / 16:9 / 9:16) по {@link getMediaDisplayFormat}, `object-fit: cover` и max-height.
 * - иначе: натуральное соотношение сторон + maxHeight (превью создания поста, экран поста без edge).
 */
function SinglePostMedia({
  url,
  isVideo,
  maxHeight = "min(85vh, 920px)",
  className,
  shellClassName,
  feedVideoAutoplay,
  feedVideoSoundOn = false,
  feedReelsInteraction = null,
  cropCover = false,
}: {
  url: string;
  isVideo: boolean;
  maxHeight?: string;
  className?: string;
  /** Вместо `SINGLE_SHELL` (например профиль edge-to-edge). */
  shellClassName?: string;
  feedVideoAutoplay?: boolean;
  feedVideoSoundOn?: boolean;
  feedReelsInteraction?: FeedReelsInteraction | null;
  /** Лента/профиль: обрезка по рамке, без искажения пропорций */
  cropCover?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [intrinsic, setIntrinsic] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setReady(false);
    setIntrinsic(null);
  }, [url]);

  const containerClass = cn(shellClassName ?? SINGLE_SHELL, !ready && "min-h-[120px]", className);

  const naturalMediaClass = "block h-auto w-full max-w-full";
  const naturalStyle = { maxHeight } satisfies CSSProperties;

  const coverMediaClass = "absolute inset-0 h-full w-full object-cover";

  const onImgLoadCrop = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w > 0 && h > 0) setIntrinsic({ w, h });
    setReady(true);
  };

  const onVideoMetaCrop = (e: SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth > 0 && v.videoHeight > 0) setIntrinsic({ w: v.videoWidth, h: v.videoHeight });
    setReady(true);
  };

  if (cropCover) {
    const arToken = intrinsic
      ? getFeedSingleCropAspectRatio(getMediaDisplayFormat(intrinsic.w, intrinsic.h))
      : "1/1";
    const [awS, ahS] = arToken.split("/");
    const aw = Number(awS);
    const ah = Number(ahS);
    const pbPercent = aw > 0 && ah > 0 ? (ah / aw) * 100 : 100;

    return (
      <div className={containerClass}>
        <div className="relative w-full overflow-hidden bg-black" style={{ maxHeight }}>
          <div className="relative h-0 w-full" style={{ paddingBottom: `${pbPercent}%` }}>
            <div className="absolute inset-0 overflow-hidden">
              {isVideo ? (
                feedVideoAutoplay ? (
                  <FeedInlineVideo
                    src={url}
                    className={coverMediaClass}
                    onLoadedMetadata={onVideoMetaCrop}
                    soundOn={feedVideoSoundOn}
                    feedReelsInteraction={feedReelsInteraction}
                  />
                ) : (
                  <video
                    src={url}
                    controls
                    playsInline
                    className={coverMediaClass}
                    onLoadedMetadata={onVideoMetaCrop}
                  />
                )
              ) : (
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={coverMediaClass}
                  onLoad={onImgLoadCrop}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={containerClass}>
        {feedVideoAutoplay ? (
          <FeedInlineVideo
            src={url}
            className={naturalMediaClass}
            style={naturalStyle}
            onLoadedMetadata={() => setReady(true)}
            soundOn={feedVideoSoundOn}
            feedReelsInteraction={feedReelsInteraction}
          />
        ) : (
          <video
            src={url}
            controls
            playsInline
            className={naturalMediaClass}
            style={naturalStyle}
            onLoadedMetadata={() => setReady(true)}
          />
        )}
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
        className={naturalMediaClass}
        style={naturalStyle}
        onLoad={() => setReady(true)}
      />
    </div>
  );
}

type PostMediaProps = {
  /** Список URL фото/видео (1–10). Как во ВКонтакте: разная сетка по количеству. */
  mediaUrls: string[];
  /** Зафиксированный layout из БД, чтобы одинаково отображалось у всех клиентов. */
  layout?: PostMediaLayout | null;
  /** Макс. высота блока медиа в ленте (одиночное crop + обрезка коллажа по сетке). */
  maxHeight?: string;
  className?: string;
  /** Медиа на всю ширину без боковых отступов/скруглений оболочки (карточка профиля / лента). */
  edgeToEdge?: boolean;
  /** В ленте: видео без звука, автоплей при скролле, пауза вне экрана */
  feedVideoAutoplay?: boolean;
  /** В ленте: для этого блока включён звук (кнопка «звук»). */
  feedVideoSoundOn?: boolean;
  /** Двойной тап / удержание скорости на видео в ленте (как рилсы). */
  feedReelsInteraction?: FeedReelsInteraction | null;
  /**
   * Одно фото/видео: обрезка под рамку (object-fit: cover), без растягивания.
   * Включается вместе с edgeToEdge в ленте и профиле.
   */
  singleMediaCropCover?: boolean;
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
  maxHeight = "min(85vh, 920px)",
  className,
  edgeToEdge = false,
  feedVideoAutoplay = false,
  feedVideoSoundOn = false,
  feedReelsInteraction = null,
  singleMediaCropCover,
}: PostMediaProps) {
  const cropSingle = singleMediaCropCover ?? edgeToEdge;
  if (!mediaUrls.length) return null;

  const resolved = mediaUrls.map((u) => resolveUrl(u));
  const collageShell = edgeToEdge ? PROFILE_EDGE_COLLAGE : COLLAGE_SHELL;
  const collageGap = edgeToEdge ? "gap-0" : "gap-px";
  const collageCell = edgeToEdge ? COLLAGE_CELL_EDGE : COLLAGE_CELL;

  const renderCollageVideo = (url: string, videoClassName: string) =>
    feedVideoAutoplay ? (
      <div className="h-full w-full min-h-0 min-w-0" onClick={(e) => e.stopPropagation()}>
        <FeedInlineVideo
          src={url}
          className={videoClassName}
          soundOn={feedVideoSoundOn}
          feedReelsInteraction={feedReelsInteraction}
        />
      </div>
    ) : (
      <video src={url} controls className={videoClassName} playsInline onClick={(e) => e.stopPropagation()} />
    );
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

  // Одно медиа — натуральное соотношение сторон (layout.format в БД только для совместимости, на высоту не влияет)
  if (n === 1) {
    return (
      <>
        <SinglePostMedia
          url={visual[0]}
          isVideo={isVideoUrl(visual[0])}
          maxHeight={maxHeight}
          className={className}
          shellClassName={edgeToEdge ? PROFILE_EDGE_SINGLE : undefined}
          feedVideoAutoplay={feedVideoAutoplay}
          feedVideoSoundOn={feedVideoSoundOn}
          feedReelsInteraction={feedReelsInteraction}
          cropCover={cropSingle}
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
        <div className={cn(`${collageShell} flex`, collageGap, className)}>
          {visual.map((url, i) => (
            <div key={i} className={cn("flex-1 min-w-0 aspect-square", collageCell)}>
              {isVideoUrl(url) ? (
                renderCollageVideo(url, "w-full h-full object-cover")
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
        <div className={cn(`${collageShell} flex`, collageGap, className)}>
          <div className={cn("w-2/3 min-w-0 aspect-[4/3]", collageCell)}>
            {isVideoUrl(visual[0]) ? (
              renderCollageVideo(visual[0], "w-full h-full object-cover")
            ) : (
              <img src={visual[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            )}
          </div>
          <div className={cn("w-1/3 flex flex-col", collageGap)}>
            {[visual[1], visual[2]].map((url, i) => (
              <div key={i} className={cn("flex-1 min-h-0", collageCell)}>
                {isVideoUrl(url) ? (
                  renderCollageVideo(url, "w-full h-full object-cover")
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
        <div className={cn(`${collageShell} grid grid-cols-2`, collageGap, className)}>
          {visual.map((url, i) => (
            <div key={i} className={cn("aspect-square", collageCell)}>
              {isVideoUrl(url) ? (
                renderCollageVideo(url, "w-full h-full object-cover")
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
      <div className={cn(`${collageShell} grid grid-cols-2`, collageGap, className)}>
        {visual.slice(0, 4).map((url, i) => (
          <div key={i} className={cn("aspect-square relative", collageCell)}>
            {isVideoUrl(url) ? (
              renderCollageVideo(url, "w-full h-full object-cover")
            ) : (
              <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            )}
          </div>
        ))}
        <div className={cn("col-span-2 aspect-[2/1] relative", collageCell)}>
          {isVideoUrl(visual[4]) ? (
            renderCollageVideo(visual[4], "w-full h-full object-cover")
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
