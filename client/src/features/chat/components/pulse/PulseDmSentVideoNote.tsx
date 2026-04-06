/**
 * Исходящий видеокружок в чате (PULSE): как video-circle-snippet.tsx —
 * один тап → play/pause; long press или кнопка → полный экран + autoplay.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Pause, Play, X } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useLongPress } from "@/hooks/useLongPress";
import {
  formatVideoNoteDuration,
  nextVideoNotePlaybackRate,
  type VideoNotePlaybackRate,
} from "@/features/chat/components/video-note/playback-utils";
import { registerChatMessageMediaPlaybackPauser } from "@/features/chat/chat-message-media-playback-interrupt";

type Props = {
  src: string;
  posterSrc?: string | null;
  accentColor: string;
  durationSec?: number | null;
  /** Время под кружком (как «14:07» в макете); без дубля с футером строки */
  footerLabel?: string | null;
  /** Подсказка по доставке/прочтению (title), если есть footerLabel */
  footerHintTitle?: string | null;
  /** Кратко для screen reader вместе с footerLabel */
  footerHintAria?: string | null;
  className?: string;
  /** 0–100: отправка — кольцо по контуру кружка */
  uploadProgress?: number | null;
  /** Вызывается при завершении воспроизведения (для автоперехода к следующему кружку). */
  onEnded?: () => void;
  /** Автозапуск кружка (например, после завершения предыдущего). */
  autoPlay?: boolean;
};

export function PulseDmSentVideoNote({
  src,
  posterSrc,
  accentColor,
  durationSec = null,
  footerLabel,
  footerHintTitle,
  footerHintAria,
  className,
  uploadProgress,
  onEnded,
  autoPlay,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const acc = accentColor;
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [inlineMediaActivated, setInlineMediaActivated] = useState(false);
  const [posterReady, setPosterReady] = useState(Boolean(posterSrc));
  const [expandedVideo, setExpandedVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<VideoNotePlaybackRate>(1);
  const inlineRootRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFsRef = useRef<HTMLVideoElement | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  /** При воспроизведении кружок плавно увеличивается (раньше было заглушено `false`). */
  const inlineExpanded = videoPlaying;
  const size = inlineExpanded ? 230 : 140;
  const rSvg = 111;
  const dash = 2 * Math.PI * rSvg;
  const up =
    uploadProgress != null && Number.isFinite(uploadProgress)
      ? Math.max(0, Math.min(100, uploadProgress))
      : null;
  const uploadRingR = size / 2 - 5;
  const uploadRingLen = 2 * Math.PI * uploadRingR;

  useEffect(() => {
    const node = inlineRootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInlineMediaActivated(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setInlineMediaActivated(true);
        observer.disconnect();
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const v = expandedVideo ? videoFsRef.current : videoRef.current;
    if (!v) return;
    const onUpd = () => {
      if (v.duration && Number.isFinite(v.duration)) setProgress(v.currentTime / v.duration);
    };
    const onEnd = () => {
      setVideoPlaying(false);
      setProgress(0);
      onEndedRef.current?.();
    };
    v.addEventListener("timeupdate", onUpd);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onUpd);
      v.removeEventListener("ended", onEnd);
    };
  }, [expandedVideo, src]);

  useEffect(() => {
    if (!autoPlay || videoPlaying) return;
    setInlineMediaActivated(true);
    setVideoPlaying(true);
  }, [autoPlay, videoPlaying]);

  useEffect(() => {
    return registerChatMessageMediaPlaybackPauser(() => {
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
      try {
        videoFsRef.current?.pause();
      } catch {
        /* ignore */
      }
      setVideoPlaying(false);
      setExpandedVideo(false);
      setProgress(0);
    });
  }, []);

  /* Inline: синхронизация play/pause с состоянием */
  useEffect(() => {
    if (expandedVideo) return;
    const v = videoRef.current;
    if (!v) return;
    if (videoPlaying) void v.play().catch(() => setVideoPlaying(false));
    else v.pause();
  }, [videoPlaying, expandedVideo, src]);

  useEffect(() => {
    if (!expandedVideo) return;
    const a = videoRef.current;
    const b = videoFsRef.current;
    if (!b) return;
    if (a) b.currentTime = a.currentTime;
    if (videoPlaying) void b.play().catch(() => setVideoPlaying(false));
    else b.pause();
  }, [expandedVideo, videoPlaying]);

  useEffect(() => {
    const inline = videoRef.current;
    const fullscreen = videoFsRef.current;
    if (inline) inline.playbackRate = playbackRate;
    if (fullscreen) fullscreen.playbackRate = playbackRate;
  }, [playbackRate, expandedVideo, src]);

  const openFullscreen = useCallback(() => {
    setInlineMediaActivated(true);
    setExpandedVideo(true);
    setVideoPlaying(true);
  }, []);

  const longPressHandlers = useLongPress({
    durationMs: 320,
    onLongPress: openFullscreen,
  });

  const handleVideoClick = useCallback(() => {
    setInlineMediaActivated(true);
    setVideoPlaying((v) => !v);
  }, []);

  const totalSec = durationSec && durationSec > 0 ? durationSec : 15;
  const timeLabel = videoPlaying ? formatVideoNoteDuration(progress * totalSec) : formatVideoNoteDuration(totalSec);

  const overlay =
    expandedVideo &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(28px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Видеокружок"
        onClick={() => {
          setExpandedVideo(false);
          setVideoPlaying(false);
        }}
      >
        <div
          className="flex flex-col items-center gap-6 px-4 pt-[env(safe-area-inset-top,0px)] pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative overflow-hidden rounded-full"
            style={{
              width: 280,
              height: 280,
              background: "radial-gradient(ellipse at 40% 35%,rgba(80,60,180,0.65),rgba(8,6,22,0.96))",
              border: `3px solid ${acc}88`,
              animation: reducedMotion ? undefined : "pulse-dm-expandCircle 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <video
              ref={videoFsRef}
              src={src}
              className="absolute inset-0 z-0 h-full w-full object-cover"
              playsInline
              preload="metadata"
            />
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
              <div
                className="rounded-full opacity-25"
                style={{
                  width: 130,
                  height: 130,
                  background: `radial-gradient(circle,${acc}88,transparent 70%)`,
                }}
              />
            </div>
            <div className="absolute inset-0 z-[2] flex items-center justify-center">
              <TapScaleButton
                type="button"
                haptic
                className="flex items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ width: 72, height: 72, background: "rgba(0,0,0,0.52)", backdropFilter: "blur(10px)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoPlaying((p) => !p);
                }}
                aria-label={videoPlaying ? "Пауза" : "Воспроизвести"}
              >
                {videoPlaying ? (
                  <Pause className="h-[26px] w-[26px] text-white" />
                ) : (
                  <Play className="ml-1 h-[26px] w-[26px] text-white" />
                )}
              </TapScaleButton>
            </div>
            <svg className="pointer-events-none absolute inset-0 z-[3]" viewBox="0 0 280 280" style={{ opacity: 0.35 }}>
              <circle
                cx="140"
                cy="140"
                r="136"
                fill="none"
                stroke={acc}
                strokeWidth="2"
                strokeDasharray="855"
                strokeDashoffset={855 * (1 - progress)}
                style={{
                  transformOrigin: "center",
                  transform: "rotate(-90deg)",
                  transition: reducedMotion ? undefined : "stroke-dashoffset 0.25s linear",
                }}
              />
            </svg>
            <span
              className="absolute bottom-[22px] right-6 z-[4] font-mono text-[13px] text-white/85"
              style={{ background: "rgba(0,0,0,0.55)", padding: "3px 8px", borderRadius: 6 }}
            >
              {timeLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <TapScaleButton
              type="button"
              className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white/[0.09] px-3 text-xs font-semibold text-white/90"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              aria-label={`Скорость воспроизведения ${playbackRate}x. Нажмите для переключения`}
              onClick={() => setPlaybackRate((prev) => nextVideoNotePlaybackRate(prev))}
            >
              {playbackRate}x
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              className="flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white"
              style={{ background: acc }}
              onClick={() => setVideoPlaying((v) => !v)}
            >
              {videoPlaying ? (
                <>
                  <Pause className="h-4 w-4" aria-hidden />
                  Пауза
                </>
              ) : (
                <>
                  <Play className="ml-0.5 h-4 w-4" aria-hidden />
                  Играть
                </>
              )}
            </TapScaleButton>
            <TapScaleButton
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.09]"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              aria-label="Закрыть"
              onClick={() => {
                setExpandedVideo(false);
                setVideoPlaying(false);
              }}
            >
              <X className="h-[18px] w-[18px] text-white/70" />
            </TapScaleButton>
          </div>

          <p className="text-[11px] text-white/28">Нажмите на фон, чтобы закрыть</p>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div className={cn("flex flex-col items-end", className)}>
        {!inlineExpanded && (
          <span className="mb-1 mr-1 text-[9px] transition-opacity" style={{ color: `${acc}77` }}>
            удержание или кнопка — полный экран
          </span>
        )}

        <button
          ref={inlineRootRef}
          type="button"
          onClick={handleVideoClick}
          {...longPressHandlers}
          className="relative block cursor-pointer overflow-hidden rounded-full outline-none"
          style={{
            width: size,
            height: size,
            transition: "width 0.45s cubic-bezier(0.34,1.4,0.64,1), height 0.45s cubic-bezier(0.34,1.4,0.64,1)",
            background: "radial-gradient(ellipse at 40% 35%,rgba(80,60,180,0.6),rgba(10,6,30,0.95))",
            border: `2.5px solid ${acc}80`,
          }}
          aria-label={
            videoPlaying
              ? inlineExpanded
                ? "Пауза и свернуть кружок"
                : "Пауза и развернуть кружок"
              : inlineExpanded
                ? "Воспроизвести и свернуть кружок"
                : "Воспроизвести и развернуть кружок"
          }
        >
          <span className="pointer-events-none absolute left-2 top-2 z-[6] rounded-full bg-black/55 px-1.5 text-[9px] font-semibold text-white/90">
            {playbackRate}x
          </span>
          <span className="pointer-events-none absolute right-2 top-2 z-[6] inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white/90">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 40% 35%,${acc}22,transparent 60%)` }}
          />
          <video
            ref={videoRef}
            src={inlineMediaActivated ? src : undefined}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
            playsInline
            preload={videoPlaying ? "auto" : "metadata"}
            muted={false}
          />
          {!inlineMediaActivated && posterSrc ? (
            <img
              src={posterSrc}
              alt="Превью видеокружка"
              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              onLoad={() => setPosterReady(true)}
              onError={() => setPosterReady(true)}
            />
          ) : null}
          {!posterReady && !inlineMediaActivated ? (
            <div className="pointer-events-none absolute inset-0 z-0 bg-black/40" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
            <div
              className="rounded-full opacity-20"
              style={{
                width: inlineExpanded ? 110 : 70,
                height: inlineExpanded ? 110 : 70,
                background: `radial-gradient(circle,${acc}88,transparent 70%)`,
                transition: "width 0.45s, height 0.45s",
              }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: inlineExpanded ? 68 : 46,
                height: inlineExpanded ? 68 : 46,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                transition: "width 0.45s, height 0.45s",
              }}
            >
              {videoPlaying ? (
                <Pause
                  className="text-white"
                  style={{
                    width: inlineExpanded ? 26 : 18,
                    height: inlineExpanded ? 26 : 18,
                    transition: "width 0.3s, height 0.3s",
                  }}
                  aria-hidden
                />
              ) : (
                <Play
                  className="text-white"
                  style={{
                    width: inlineExpanded ? 26 : 18,
                    height: inlineExpanded ? 26 : 18,
                    marginLeft: inlineExpanded ? 4 : 3,
                    transition: "width 0.3s, height 0.3s",
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>
          <span
            className="pointer-events-none absolute z-[3] font-mono text-white/85"
            style={{
              bottom: inlineExpanded ? 18 : 12,
              right: inlineExpanded ? 20 : 14,
              fontSize: inlineExpanded ? 12 : 10,
              background: "rgba(0,0,0,0.55)",
              padding: "2px 6px",
              borderRadius: 4,
              transition: "all 0.3s",
            }}
          >
            {timeLabel}
          </span>
          {up != null ? (
            <span className="pointer-events-none absolute bottom-2 left-1/2 z-[6] -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] text-white/90">
              {up >= 100 ? "Отправка…" : `Загрузка ${up}%`}
            </span>
          ) : null}
          {inlineExpanded && (
            <svg
              className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
              viewBox="0 0 230 230"
              style={{ opacity: 0.45 }}
            >
              <circle
                cx="115"
                cy="115"
                r={rSvg}
                fill="none"
                stroke={acc}
                strokeWidth="2.5"
                strokeDasharray={dash}
                strokeDashoffset={dash * (1 - progress)}
                style={{
                  transformOrigin: "center",
                  transform: "rotate(-90deg)",
                  transition: reducedMotion ? undefined : "stroke-dashoffset 0.25s linear",
                }}
              />
            </svg>
          )}
          {!inlineExpanded && (
            <div
              className="pointer-events-none absolute inset-[-4px] rounded-full"
              style={{
                border: `1.5px solid ${acc}44`,
                animation:
                  videoPlaying && !reducedMotion ? "pulse-dm-ringPulseVideo 2.5s ease-in-out infinite" : "none",
              }}
            />
          )}
          {up != null ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
              viewBox={`0 0 ${size} ${size}`}
              aria-hidden
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={uploadRingR}
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="3"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={uploadRingR}
                fill="none"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={uploadRingLen}
                strokeDashoffset={uploadRingLen * (1 - up / 100)}
                style={{
                  transform: `rotate(-90deg)`,
                  transformOrigin: `${size / 2}px ${size / 2}px`,
                }}
              />
            </svg>
          ) : null}
        </button>

        {inlineExpanded && (
          <span className="mr-1 mt-1 text-[9px]" style={{ color: `${acc}66` }}>
            тап — play/pause · удержание — fullscreen
          </span>
        )}

        {footerLabel ? (
          <span
            className="mr-0.5 mt-1.5 text-[10px] text-white/28"
            title={footerHintTitle ?? undefined}
            aria-label={footerHintAria ?? footerHintTitle ?? undefined}
          >
            {footerLabel}
          </span>
        ) : null}
      </div>
      {overlay}
    </>
  );
}
