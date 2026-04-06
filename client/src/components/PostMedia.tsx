import { useState, useEffect, type CSSProperties, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import type { PostMediaLayout } from "@shared/post-media-layout";
import { FeedInlineVideo, type FeedReelsInteraction } from "@/components/FeedInlineVideo";
import { FeedDoubleTapImageLayer } from "@/lib/reels-video";
import { getMediaDisplayFormat, getFeedSingleCropAspectRatio } from "@/lib/media-format";
import { isUploadedVideoMediaUrl } from "@/lib/feed-video-post";

/** Единая оболочка коллажа и одиночного медиа в ленте / профиле */
const MEDIA_TOP = "mt-[var(--uix-space-3)]";
const COLLAGE_SHELL = `${MEDIA_TOP} rounded-2xl overflow-hidden border border-border/40 bg-muted/20 shadow-sm ring-1 ring-black/[0.04]`;
const SINGLE_SHELL = `${MEDIA_TOP} rounded-2xl overflow-hidden border border-border/40 bg-muted/25 shadow-sm ring-1 ring-black/[0.04] w-full`;
/** Во всю ширину экрана (лента / профиль PULSE), без боковых отступов и скруглений оболочки */
/** Подложка под медиа: не чистый #000 — иначе выглядит как «битое» до декода кадра/пикселей */
const MEDIA_BACKPLATE_EDGE = "bg-neutral-200 dark:bg-zinc-950";
const PROFILE_EDGE_COLLAGE = `mt-0 w-full rounded-none overflow-hidden border-0 ${MEDIA_BACKPLATE_EDGE} shadow-none ring-0`;
const PROFILE_EDGE_SINGLE = `mt-0 w-full rounded-none overflow-hidden border-0 ${MEDIA_BACKPLATE_EDGE} shadow-none ring-0`;
const COLLAGE_CELL = "bg-black/[0.06] flex items-center justify-center";
const COLLAGE_CELL_EDGE = `${MEDIA_BACKPLATE_EDGE} flex items-center justify-center`;

function isAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(url);
}

/** Картинка в ленте/профиле: при сетевой ошибке не оставляем «вечный чёрный квадрат» */
function PostMediaImg({
  src,
  eager,
  className,
  style,
  onLoad,
}: {
  src: string;
  eager: boolean;
  className?: string;
  style?: CSSProperties;
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setFailed(false);
    setRetryTick(0);
  }, [src]);

  const resolvedSrc =
    retryTick > 0 ? `${src}${src.includes("?") ? "&" : "?"}pm_retry=${retryTick}` : src;

  if (failed) {
    return (
      <div
        className={cn(
          "flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 bg-muted/50 px-2 py-3 text-center text-muted-foreground",
          className,
        )}
        role="img"
        aria-label="Изображение не загрузилось"
      >
        <span className="text-[12px] leading-snug">Не удалось загрузить</span>
        <button
          type="button"
          className="min-h-[var(--uix-touch-min)] px-2 text-[12px] font-medium text-primary underline underline-offset-2"
          onClick={(e) => {
            e.stopPropagation();
            setFailed(false);
            setRetryTick((t) => t + 1);
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={() => setFailed(true)}
    />
  );
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
  feedReelsDeferredOpen,
  cropCover = false,
  /** Лента с виртуализацией: без native lazy — иначе кадр с чёрным фоном до позднего старта загрузки */
  eagerImages = false,
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
  feedReelsDeferredOpen?: () => void;
  /** Лента/профиль: обрезка по рамке, без искажения пропорций */
  cropCover?: boolean;
  eagerImages?: boolean;
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
        <div className={cn("relative w-full overflow-hidden", MEDIA_BACKPLATE_EDGE)} style={{ maxHeight }}>
          <div className="relative h-0 w-full" style={{ paddingBottom: `${pbPercent}%` }}>
            {!ready ? (
              <div
                className="pointer-events-none absolute inset-0 z-[1] animate-pulse"
                style={{
                  background:
                    "linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 38%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0.03) 72%, rgba(255,255,255,0.06) 100%)",
                }}
                aria-hidden
              />
            ) : null}
            <div className="absolute inset-0 overflow-hidden">
              {isVideo ? (
                feedVideoAutoplay ? (
                  <FeedInlineVideo
                    src={url}
                    className={coverMediaClass}
                    onLoadedMetadata={onVideoMetaCrop}
                    onFrameReady={() => setReady(true)}
                    soundOn={feedVideoSoundOn}
                    feedReelsInteraction={feedReelsInteraction}
                    onReelsDeferredOpen={feedReelsDeferredOpen}
                  />
                ) : (
                  <video
                    src={url}
                    controls
                    playsInline
                    className={coverMediaClass}
                    onLoadedMetadata={onVideoMetaCrop}
                    onLoadedData={() => setReady(true)}
                  />
                )
              ) : feedReelsInteraction ? (
                <FeedDoubleTapImageLayer
                  className="absolute inset-0"
                  onDoubleTap={feedReelsInteraction.onDoubleTapFire}
                >
                  <PostMediaImg
                    src={url}
                    eager={eagerImages}
                    className={cn(coverMediaClass, "pointer-events-none")}
                    onLoad={onImgLoadCrop}
                  />
                </FeedDoubleTapImageLayer>
              ) : (
                <PostMediaImg
                  src={url}
                  eager={eagerImages}
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
        {!ready ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] animate-pulse"
            style={{
              background:
                "linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 38%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0.03) 72%, rgba(255,255,255,0.06) 100%)",
            }}
            aria-hidden
          />
        ) : null}
        {feedVideoAutoplay ? (
          <FeedInlineVideo
            src={url}
            className={naturalMediaClass}
            style={naturalStyle}
            onFrameReady={() => setReady(true)}
            soundOn={feedVideoSoundOn}
            feedReelsInteraction={feedReelsInteraction}
            onReelsDeferredOpen={feedReelsDeferredOpen}
          />
        ) : (
          <video
            src={url}
            controls
            playsInline
            className={naturalMediaClass}
            style={naturalStyle}
            onLoadedData={() => setReady(true)}
          />
        )}
      </div>
    );
  }

  const photoOnly = (
    <PostMediaImg
      src={url}
      eager={eagerImages}
      className={cn(naturalMediaClass, feedReelsInteraction && "pointer-events-none")}
      style={naturalStyle}
      onLoad={() => setReady(true)}
    />
  );

  return (
    <div className={containerClass}>
      {!ready ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] animate-pulse"
          style={{
            background:
              "linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 38%, rgba(255,255,255,0.08) 52%, rgba(255,255,255,0.03) 72%, rgba(255,255,255,0.06) 100%)",
          }}
          aria-hidden
        />
      ) : null}
      {feedReelsInteraction ? (
        <FeedDoubleTapImageLayer className="relative w-full max-w-full" onDoubleTap={feedReelsInteraction.onDoubleTapFire}>
          {photoOnly}
        </FeedDoubleTapImageLayer>
      ) : (
        photoOnly
      )}
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
  /** Лента: двойной тап по фото/видео/аудио-блоку — лайк (🔥). */
  feedReelsInteraction?: FeedReelsInteraction | null;
  /** Лента: одиночный тап по видео — видеолента на этом ролике. */
  feedReelsDeferredOpen?: () => void;
  /**
   * Одно фото/видео: обрезка под рамку (object-fit: cover), без растягивания.
   * Включается вместе с edgeToEdge в ленте и профиле.
   */
  singleMediaCropCover?: boolean;
  /** Лента: сразу запрашивать изображения (виртуализация уже ограничивает DOM). */
  feedEagerImages?: boolean;
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
  feedReelsDeferredOpen,
  singleMediaCropCover,
  feedEagerImages = false,
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
          onReelsDeferredOpen={feedReelsDeferredOpen}
        />
      </div>
    ) : (
      <video src={url} controls className={videoClassName} playsInline onClick={(e) => e.stopPropagation()} />
    );

  const renderCollageImage = (url: string, imgClassName: string) =>
    feedReelsInteraction ? (
      <FeedDoubleTapImageLayer
        className="h-full w-full min-h-0 min-w-0"
        onDoubleTap={feedReelsInteraction.onDoubleTapFire}
      >
        <PostMediaImg
          src={url}
          eager={feedEagerImages}
          className={cn(imgClassName, "pointer-events-none")}
        />
      </FeedDoubleTapImageLayer>
    ) : (
      <PostMediaImg src={url} eager={feedEagerImages} className={imgClassName} />
    );

  const visual = resolved.filter((u) => !isAudioUrl(u));
  const audio = resolved.filter((u) => isAudioUrl(u));
  const n = visual.length;

  const renderAudioList = () => {
    if (!audio.length) return null;
    const block = (
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
    if (!feedReelsInteraction) return block;
    return (
      <FeedDoubleTapImageLayer className="min-w-0 w-full" onDoubleTap={feedReelsInteraction.onDoubleTapFire}>
        {block}
      </FeedDoubleTapImageLayer>
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
          isVideo={isUploadedVideoMediaUrl(visual[0])}
          maxHeight={maxHeight}
          className={className}
          shellClassName={edgeToEdge ? PROFILE_EDGE_SINGLE : undefined}
          feedVideoAutoplay={feedVideoAutoplay}
          feedVideoSoundOn={feedVideoSoundOn}
          feedReelsInteraction={feedReelsInteraction}
          feedReelsDeferredOpen={feedReelsDeferredOpen}
          cropCover={cropSingle}
          eagerImages={feedEagerImages}
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
              {isUploadedVideoMediaUrl(url) ? (
                renderCollageVideo(url, "w-full h-full object-cover")
              ) : (
                renderCollageImage(url, "w-full h-full object-cover")
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
            {isUploadedVideoMediaUrl(visual[0]) ? (
              renderCollageVideo(visual[0], "w-full h-full object-cover")
            ) : (
              renderCollageImage(visual[0], "w-full h-full object-cover")
            )}
          </div>
          <div className={cn("w-1/3 flex flex-col", collageGap)}>
            {[visual[1], visual[2]].map((url, i) => (
              <div key={i} className={cn("flex-1 min-h-0", collageCell)}>
                {isUploadedVideoMediaUrl(url) ? (
                  renderCollageVideo(url, "w-full h-full object-cover")
                ) : (
                  renderCollageImage(url, "w-full h-full object-cover")
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
              {isUploadedVideoMediaUrl(url) ? (
                renderCollageVideo(url, "w-full h-full object-cover")
              ) : (
                renderCollageImage(url, "w-full h-full object-cover")
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
            {isUploadedVideoMediaUrl(url) ? (
              renderCollageVideo(url, "w-full h-full object-cover")
            ) : (
              renderCollageImage(url, "w-full h-full object-cover")
            )}
          </div>
        ))}
        <div className={cn("col-span-2 aspect-[2/1] relative", collageCell)}>
          {isUploadedVideoMediaUrl(visual[4]) ? (
            renderCollageVideo(visual[4], "w-full h-full object-cover")
          ) : (
            renderCollageImage(visual[4], "w-full h-full object-cover")
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
