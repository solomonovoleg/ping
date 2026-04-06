import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaLoadError } from "@/features/chat/components/MediaLoadError";
import {
  formatVideoNoteDuration,
  nextVideoNotePlaybackRate,
  type VideoNotePlaybackRate,
} from "@/features/chat/components/video-note/playback-utils";
import { registerChatMessageMediaPlaybackPauser } from "@/features/chat/chat-message-media-playback-interrupt";

const VIDEO_NOTE_PREVIEW_SEC = 1.2;
const VIDEO_NOTE_PLAY_START_SEC = 0.15;

type Props = {
  src: string;
  posterSrc?: string | null;
  isMe: boolean;
  /** Класс обводки кружка (из MSG_BUBBLE_CLASSES для исходящих). */
  borderClass: string;
  uploadProgress?: number | null;
  /** Вызывается при завершении воспроизведения (для автоперехода к следующему кружку). */
  onEnded?: () => void;
  /** Автозапуск кружка (например, после завершения предыдущего). */
  autoPlay?: boolean;
};

export function VideoNoteBubble({ src, posterSrc, isMe, borderClass, uploadProgress, onEnded, autoPlay }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playRequestedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const [mediaActivated, setMediaActivated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [previewReady, setPreviewReady] = useState(Boolean(posterSrc));
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<VideoNotePlaybackRate>(1);
  const up = uploadProgress != null && Number.isFinite(uploadProgress) ? Math.max(0, Math.min(100, uploadProgress)) : null;
  const ringR = 86;
  const ringC = 2 * Math.PI * ringR;

  const effectiveSrc = retryTick > 0 ? `${src}${src.includes("?") ? "&" : "?"}vn_retry=${retryTick}` : src;

  useEffect(() => {
    setLoadError(false);
    setPreviewReady(Boolean(posterSrc));
    setMediaActivated(false);
    playRequestedRef.current = false;
  }, [src, posterSrc]);

  useEffect(() => {
    if (!mediaActivated || !playRequestedRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.playbackRate = playbackRate;
    if (video.currentTime < VIDEO_NOTE_PLAY_START_SEC || video.currentTime >= VIDEO_NOTE_PREVIEW_SEC) {
      video.currentTime = VIDEO_NOTE_PLAY_START_SEC;
    }
    void video.play().catch(() => {});
    playRequestedRef.current = false;
  }, [mediaActivated, playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!autoPlay || isPlaying) return;
    playRequestedRef.current = true;
    setMediaActivated(true);
  }, [autoPlay, isPlaying]);

  useEffect(() => {
    return registerChatMessageMediaPlaybackPauser(() => {
      playRequestedRef.current = false;
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
    });
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (!mediaActivated) {
        playRequestedRef.current = true;
        setMediaActivated(true);
        return;
      }
      video.muted = false;
      if (video.currentTime < VIDEO_NOTE_PLAY_START_SEC || video.currentTime >= VIDEO_NOTE_PREVIEW_SEC) {
        video.currentTime = VIDEO_NOTE_PLAY_START_SEC;
      }
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  };

  if (loadError) {
    return (
      <div className={cn("flex", isPlaying && "w-full justify-center")}>
        <MediaLoadError
          message="Не удалось загрузить видеокружок."
          className="h-[176px] w-[176px] rounded-full"
          onRetry={() => {
            setLoadError(false);
            setRetryTick((t) => t + 1);
            setMediaActivated(false);
            playRequestedRef.current = false;
          }}
        />
      </div>
    );
  }

  const activating = mediaActivated && !previewReady;

  return (
    <div className={cn("flex", isPlaying && "w-full justify-center")}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          togglePlayback();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setPlaybackRate((prev) => nextVideoNotePlaybackRate(prev));
        }}
        className={cn(
          "group relative block h-[176px] w-[176px] overflow-hidden rounded-full border shadow-md transition-transform duration-300 ease-out will-change-transform",
          isPlaying ? "z-10 scale-[1.4]" : "scale-100",
          borderClass,
        )}
        aria-label={isPlaying ? "Пауза видеокружка" : "Воспроизвести видеокружок"}
      >
        <span className="pointer-events-none absolute right-2 top-2 z-[7] rounded-full bg-black/55 px-2 text-[10px] font-semibold tabular-nums text-white/95">
          {playbackRate}x
        </span>
        <video
          ref={videoRef}
          src={mediaActivated ? effectiveSrc : undefined}
          className="h-full w-full object-cover"
          playsInline
          muted={!isPlaying}
          preload={isPlaying ? "auto" : "metadata"}
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            onEndedRef.current?.();
          }}
          onLoadedMetadata={(e) => {
            const target = e.currentTarget;
            const dur = Number.isFinite(target.duration) ? target.duration : null;
            setDurationSec(dur);
            setPreviewReady(true);
          }}
          onError={() => {
            setLoadError(true);
            setPreviewReady(true);
          }}
        />
        {!mediaActivated && posterSrc ? (
          <img
            src={posterSrc}
            alt="Превью видеокружка"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onLoad={() => setPreviewReady(true)}
            onError={() => setPreviewReady(true)}
          />
        ) : null}
        {!previewReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/70">
            {activating ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden /> : null}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/95">
          {formatVideoNoteDuration(durationSec)}
        </span>
        {up != null ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90">
            {up >= 100 ? "Отправка…" : `Загрузка ${up}%`}
          </span>
        ) : null}
        {up != null ? (
          <svg
            className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
            viewBox="0 0 176 176"
            aria-hidden
          >
            <circle cx="88" cy="88" r={ringR} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
            <circle
              cx="88"
              cy="88"
              r={ringR}
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={ringC}
              strokeDashoffset={ringC * (1 - up / 100)}
              style={{ transform: "rotate(-90deg)", transformOrigin: "88px 88px" }}
            />
          </svg>
        ) : null}
      </button>
    </div>
  );
}
