import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-base";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { MediaLoadError } from "@/features/chat/components/MediaLoadError";
import { useOfflineResolvedMediaUrl } from "@/hooks/useOfflineResolvedMediaUrl";
import { scheduleRevokeObjectURL } from "@/lib/blob-url";
import { registerChatMessageMediaPlaybackPauser } from "@/features/chat/chat-message-media-playback-interrupt";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
const SPEED_CONTROL_AUTOHIDE_MS = 1800;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type BubbleColorPreset = "primary" | "slate" | "violet" | "sky";

const VOICE_ME_COLORS: Record<
  BubbleColorPreset,
  { container: string; button: string; time: string; track: string; bar: string; thumb: string }
> = {
  primary: {
    container: "bg-primary/15 dark:bg-primary/30 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    button: "bg-primary text-primary-foreground hover:bg-primary/90",
    time: "text-primary-700 dark:text-primary-200",
    track: "bg-primary/25 dark:bg-white/20",
    bar: "bg-primary",
    thumb: "bg-primary border-primary/90 dark:border-primary-foreground/30",
  },
  slate: {
    container: "bg-slate-200/90 dark:bg-slate-700/90 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    button: "bg-slate-600 text-white hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-400",
    time: "text-slate-700 dark:text-slate-300",
    track: "bg-slate-400/25 dark:bg-white/20",
    bar: "bg-slate-600 dark:bg-slate-500",
    thumb: "bg-slate-600 border-slate-700/50 dark:bg-slate-500 dark:border-slate-400/50",
  },
  violet: {
    container: "bg-violet-200/90 dark:bg-violet-900/50 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    button: "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400",
    time: "text-violet-700 dark:text-violet-200",
    track: "bg-violet-500/25 dark:bg-white/20",
    bar: "bg-violet-600 dark:bg-violet-500",
    thumb: "bg-violet-600 border-violet-700/50 dark:bg-violet-500 dark:border-violet-400/50",
  },
  sky: {
    container: "bg-sky-200/90 dark:bg-sky-900/50 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    button: "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400",
    time: "text-sky-700 dark:text-sky-200",
    track: "bg-sky-500/25 dark:bg-white/20",
    bar: "bg-sky-600 dark:bg-sky-500",
    thumb: "bg-sky-600 border-sky-700/50 dark:bg-sky-500 dark:border-sky-400/50",
  },
};

type Props = {
  src: string;
  isMe?: boolean;
  bubbleColorPreset?: BubbleColorPreset;
  chatVibeActive?: boolean;
  transcript?: string | null;
  /** Перевод расшифровки (при включённом переводе чата) */
  translatedTranscript?: string | null;
  className?: string;
  /** Вызывается при завершении воспроизведения (для «слушать следующее») */
  onEnded?: () => void;
  /** Автозапуск воспроизведения (например, при переходе с предыдущего голосового) */
  autoPlay?: boolean;
  /** 0–100: исходящая загрузка — тонкая полоска сверху пузыря */
  uploadProgress?: number | null;
};

export function VoiceMessagePlayer({
  src,
  isMe = true,
  bubbleColorPreset = "primary",
  chatVibeActive = false,
  transcript,
  translatedTranscript,
  className,
  onEnded: onEndedProp,
  autoPlay,
  uploadProgress,
}: Props) {
  const mediaSrc = useOfflineResolvedMediaUrl(src, { autoCache: true });
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const hasSetSrcRef = useRef(false);
  const blobFallbackTriedRef = useRef(false);
  const blobFallbackLoadingRef = useRef(false);
  const audioErrorHandlingRef = useRef(false);
  const speedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [speedControlVisible, setSpeedControlVisible] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const onEndedPropRef = useRef(onEndedProp);
  onEndedPropRef.current = onEndedProp;

  const clearSpeedHideTimer = useCallback(() => {
    if (!speedHideTimerRef.current) return;
    clearTimeout(speedHideTimerRef.current);
    speedHideTimerRef.current = null;
  }, []);

  const showSpeedControl = useCallback(
    (autoHideMs?: number) => {
      setSpeedControlVisible(true);
      clearSpeedHideTimer();
      if (!autoHideMs || autoHideMs <= 0) return;
      speedHideTimerRef.current = setTimeout(() => {
        setSpeedControlVisible(false);
        speedHideTimerRef.current = null;
      }, autoHideMs);
    },
    [clearSpeedHideTimer],
  );

  useEffect(() => {
    setLoadError(false);
    setLoaded(false);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setSpeedControlVisible(false);
    clearSpeedHideTimer();
    hasSetSrcRef.current = false;
    blobFallbackTriedRef.current = false;
    blobFallbackLoadingRef.current = false;
    audioErrorHandlingRef.current = false;
    const el = audioRef.current;
    if (!el) return;
    el.removeAttribute("src");
    el.load();
    // Загружаем метаданные сразу, чтобы показать длительность до воспроизведения
    if (mediaSrc) {
      el.src = mediaSrc;
      hasSetSrcRef.current = true;
      // Safari/iOS иногда не подтягивает duration до явного load().
      el.load();
    }
    const onLoadedMetadata = () => {
      const d = el.duration;
      setDuration(Number.isFinite(d) && d >= 0 ? d : 0);
      setLoaded(true);
    };
    const onDurationChange = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
        setLoaded(true);
      }
    };
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      showSpeedControl(SPEED_CONTROL_AUTOHIDE_MS);
      onEndedPropRef.current?.();
    };
    const tryBlobFallback = async () => {
      if (!src || blobFallbackTriedRef.current || blobFallbackLoadingRef.current) {
        setLoadError(true);
        setPlaying(false);
        return;
      }
      blobFallbackTriedRef.current = true;
      blobFallbackLoadingRef.current = true;
      try {
        const res = await apiFetch(src);
        if (res.status === 404) {
          setLoadError(true);
          setPlaying(false);
          return;
        }
        if (!res.ok) throw new Error("audio fetch failed");
        const blob = await res.blob();
        if (!blob || blob.size <= 0) throw new Error("empty audio blob");
        if (blobUrlRef.current) {
          scheduleRevokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        el.src = objectUrl;
        hasSetSrcRef.current = true;
        setLoadError(false);
      } catch {
        setLoadError(true);
        setPlaying(false);
      } finally {
        blobFallbackLoadingRef.current = false;
      }
    };
    const onError = () => {
      if (audioErrorHandlingRef.current || blobFallbackLoadingRef.current) return;
      audioErrorHandlingRef.current = true;
      void tryBlobFallback().finally(() => {
        audioErrorHandlingRef.current = false;
      });
    };
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      const blobUrl = blobUrlRef.current;
      blobUrlRef.current = null;
      if (blobUrl) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch {
          /* ignore */
        }
        scheduleRevokeObjectURL(blobUrl);
      }
    };
  }, [clearSpeedHideTimer, mediaSrc, showSpeedControl, src, retryGeneration]);

  useEffect(() => {
    return () => {
      clearSpeedHideTimer();
    };
  }, [clearSpeedHideTimer]);

  const setAudioSrc = useCallback(async (): Promise<boolean> => {
    const el = audioRef.current;
    if (!el || !mediaSrc) return false;
    if (hasSetSrcRef.current) return true;
    try {
      // Prefer native media loading via <audio src>, avoids CORS/auth fetch issues on iOS/Capacitor.
      el.src = mediaSrc;
      hasSetSrcRef.current = true;
      return true;
    } catch {
      setLoadError(true);
      return false;
    }
  }, [mediaSrc]);

  const togglePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      showSpeedControl(SPEED_CONTROL_AUTOHIDE_MS);
      return;
    }
    const ok = await setAudioSrc();
    if (!ok) return;
    el.playbackRate = speed;
    el.play().catch(() => setLoadError(true));
    setPlaying(true);
    showSpeedControl();
  }, [playing, setAudioSrc, showSpeedControl, speed]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    return registerChatMessageMediaPlaybackPauser(() => {
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
      setPlaying(false);
      showSpeedControl(SPEED_CONTROL_AUTOHIDE_MS);
    });
  }, [showSpeedControl]);

  /** Автозапуск при переходе с предыдущего голосового («слушать следующее») */
  useEffect(() => {
    if (!autoPlay || playing) return;
    const start = async () => {
      const ok = await setAudioSrc();
      if (!ok) return;
      const el = audioRef.current;
      if (!el) return;
      el.playbackRate = speed;
      el.play().catch(() => setLoadError(true));
      setPlaying(true);
      showSpeedControl();
    };
    void start();
  }, [autoPlay, playing, setAudioSrc, showSpeedControl, speed]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const vibeContainerStyle: React.CSSProperties | undefined = chatVibeActive
    ? {
        backgroundColor: isMe ? "var(--chat-vibe-bubble-out)" : "var(--chat-vibe-bubble-in)",
        transition:
          "background-color var(--chat-vibe-token-transition) var(--uix-easing-out), box-shadow var(--chat-vibe-token-transition) var(--uix-easing-out), border-color var(--chat-vibe-token-transition) var(--uix-easing-out)",
      }
    : undefined;
  const vibeButtonStyle: React.CSSProperties | undefined = chatVibeActive
    ? {
        backgroundColor: "var(--chat-vibe-accent)",
        transition:
          "background-color var(--chat-vibe-token-transition) var(--uix-easing-out), box-shadow var(--chat-vibe-token-transition) var(--uix-easing-out), border-color var(--chat-vibe-token-transition) var(--uix-easing-out)",
      }
    : undefined;

  const cycleSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = PLAYBACK_SPEEDS.indexOf(speed);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setSpeed(next);
    if (playing || next !== 1) {
      showSpeedControl();
      return;
    }
    showSpeedControl(SPEED_CONTROL_AUTOHIDE_MS);
  }, [playing, showSpeedControl, speed]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = pct * duration;
    setCurrentTime(el.currentTime);
  };

  const meColors = isMe ? VOICE_ME_COLORS[bubbleColorPreset] : null;
  const up =
    uploadProgress != null && Number.isFinite(uploadProgress)
      ? Math.max(0, Math.min(100, uploadProgress))
      : null;

  if (loadError) {
    return (
      <MediaLoadError
        message="Не удалось загрузить голосовое."
        className={cn(
          "rounded-xl px-3 py-2 min-h-[40px] text-[12px]",
          isMe && meColors ? meColors.container : !isMe ? "bg-muted/70 border border-border/50" : "bg-white/15",
          className,
        )}
        onRetry={() => {
          setRetryGeneration((g) => g + 1);
          setLoadError(false);
          setLoaded(false);
          setPlaying(false);
          setDuration(0);
          setCurrentTime(0);
        }}
      />
    );
  }

  const isBuffering = Boolean(mediaSrc) && !loaded && !loadError;

  return (
    <div
      className={cn(
        // Делаем голосовые визуально сопоставимыми с телеграм-стилем: не «узкие таблетки».
        "inline-flex flex-col w-[clamp(170px,58vw,260px)] max-w-[72vw]",
        className
      )}
    >
      <audio ref={audioRef} preload="metadata" playsInline />
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-xl px-2.5 py-2 min-h-[42px]",
          !chatVibeActive && isMe && meColors ? meColors.container : "",
          !chatVibeActive && !isMe ? "bg-muted/70 border border-border/50 shadow-sm" : "",
          chatVibeActive && !isMe ? "border border-black/[0.08] dark:border-white/10 shadow-[0_1px_1px_rgba(0,0,0,0.06)]" : ""
        )}
        style={vibeContainerStyle}
      >
        {up != null ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[3px] overflow-hidden rounded-t-xl bg-black/12 dark:bg-white/12"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-t-xl transition-[width] duration-150 ease-out",
                isMe && meColors ? meColors.bar : "bg-primary",
              )}
              style={{ width: `${up}%` }}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95",
              !chatVibeActive && isMe && meColors ? meColors.button : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          style={vibeButtonStyle}
          aria-label={playing ? "Пауза" : isBuffering ? "Загрузка" : "Воспроизвести"}
        >
          {playing ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : isBuffering ? (
            <Loader2 className="w-4 h-4 animate-spin opacity-90" aria-hidden />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={handleProgressClick}
            role="progressbar"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={duration}
          >
            <span
              className={cn(
                "text-[12px] font-medium tabular-nums flex-shrink-0 w-9",
                isMe && meColors ? meColors.time : "text-foreground/90"
              )}
            >
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative h-1 rounded-full overflow-visible min-w-[58px]">
              <div
                className={cn(
                  "absolute inset-0 rounded-full",
                  isMe && meColors ? meColors.track : "bg-muted-foreground/20"
                )}
              />
              <div
                className={cn(
                  "absolute left-0 top-0 h-full rounded-full transition-[width] duration-75",
                  isMe && meColors ? meColors.bar : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              />
              <div
                className={cn(
                  "absolute top-1/2 left-0 w-2.5 h-2.5 rounded-full border border-current transition-[left] duration-75 -translate-y-1/2 -translate-x-1/2",
                  isMe && meColors ? meColors.thumb : "bg-primary border-primary-foreground/30"
                )}
                style={{ left: `${progress}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[12px] font-medium tabular-nums flex-shrink-0 text-right min-w-[2.25rem]",
                isMe && meColors ? meColors.time : "text-muted-foreground"
              )}
            >
              {Number.isFinite(duration) && duration > 0 ? formatTime(duration) : "0:00"}
            </span>
            <div className="ml-1 w-[44px] flex-shrink-0">
              <TapScaleButton
                type="button"
                onClick={cycleSpeed}
                className={cn(
                  "inline-flex min-h-[22px] min-w-[38px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums transition-all duration-150",
                  isMe && meColors
                    ? "bg-black/10 text-current hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted",
                  speedControlVisible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
                )}
                title={`Скорость: ${speed}x. Тап — смена`}
                aria-label={`Скорость воспроизведения ${speed}x`}
                aria-hidden={!speedControlVisible}
                tabIndex={speedControlVisible ? 0 : -1}
              >
                {speed}x
              </TapScaleButton>
            </div>
          </div>
        </div>
      </div>
      {(transcript?.trim() || translatedTranscript?.trim()) && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setTranscriptOpen((prev) => !prev)}
            className="text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            aria-expanded={transcriptOpen}
          >
            {transcriptOpen ? "Скрыть текст" : "Показать текст"}
          </button>
          {transcriptOpen && (
            <div className="mt-1 text-[11px] text-muted-foreground/85 leading-snug whitespace-pre-wrap break-words">
              <p>{(translatedTranscript?.trim() || transcript?.trim()) ?? ""}</p>
              {translatedTranscript?.trim() &&
              transcript?.trim() &&
              translatedTranscript.trim() !== transcript.trim() ? (
                <p className="mt-1 text-[10px] opacity-75">Оригинал: {transcript.trim()}</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
