import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-base";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useOfflineResolvedMediaUrl } from "@/hooks/useOfflineResolvedMediaUrl";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
const SPEED_STORAGE_KEY = "ping:voice-speed";

function getStoredSpeed(): number {
  if (typeof window === "undefined") return 1;
  const v = localStorage.getItem(SPEED_STORAGE_KEY);
  const n = parseFloat(v ?? "1");
  return PLAYBACK_SPEEDS.includes(n as (typeof PLAYBACK_SPEEDS)[number]) ? n : 1;
}

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
  transcript?: string | null;
  /** Перевод расшифровки (при включённом переводе чата) */
  translatedTranscript?: string | null;
  className?: string;
  /** Вызывается при завершении воспроизведения (для «слушать следующее») */
  onEnded?: () => void;
  /** Автозапуск воспроизведения (например, при переходе с предыдущего голосового) */
  autoPlay?: boolean;
};

export function VoiceMessagePlayer({
  src,
  isMe = true,
  bubbleColorPreset = "primary",
  transcript,
  translatedTranscript,
  className,
  onEnded: onEndedProp,
  autoPlay,
}: Props) {
  const mediaSrc = useOfflineResolvedMediaUrl(src, { autoCache: true });
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const hasSetSrcRef = useRef(false);
  const blobFallbackTriedRef = useRef(false);
  const blobFallbackLoadingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [speed, setSpeed] = useState(getStoredSpeed);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const onEndedPropRef = useRef(onEndedProp);
  onEndedPropRef.current = onEndedProp;

  useEffect(() => {
    setLoadError(false);
    setLoaded(false);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    hasSetSrcRef.current = false;
    blobFallbackTriedRef.current = false;
    blobFallbackLoadingRef.current = false;
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
        if (!res.ok) throw new Error("audio fetch failed");
        const blob = await res.blob();
        if (!blob || blob.size <= 0) throw new Error("empty audio blob");
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
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
      void tryBlobFallback();
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
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [mediaSrc, src]);

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
      return;
    }
    const ok = await setAudioSrc();
    if (!ok) return;
    el.playbackRate = speed;
    el.play().catch(() => setLoadError(true));
    setPlaying(true);
  }, [playing, setAudioSrc, speed]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

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
    };
    void start();
  }, [autoPlay, playing, setAudioSrc, speed]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const cycleSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = PLAYBACK_SPEEDS.indexOf(speed as (typeof PLAYBACK_SPEEDS)[number]);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_STORAGE_KEY, String(next));
    } catch {}
  }, [speed]);

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

  if (loadError) {
    return (
      <div
        className={cn(
          "rounded-xl px-3 py-2 min-h-[40px] flex items-center gap-2 text-muted-foreground text-[12px]",
          isMe && meColors ? meColors.container : !isMe ? "bg-muted/70 border border-border/50" : "bg-white/15",
          className
        )}
      >
        <span>Не удалось загрузить голосовое.</span>
      </div>
    );
  }

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
          "flex items-center gap-2 rounded-xl px-2.5 py-2 min-h-[42px]",
          isMe && meColors ? meColors.container : !isMe ? "bg-muted/70 border border-border/50 shadow-sm" : ""
        )}
      >
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95",
            isMe && meColors ? meColors.button : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? (
            <Pause className="w-4 h-4 fill-current" />
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
            <TapScaleButton
              type="button"
              onClick={cycleSpeed}
              className={cn(
                "text-[12px] font-medium tabular-nums flex-shrink-0 text-right min-w-[2.25rem]",
                isMe && meColors ? meColors.time : "text-muted-foreground"
              )}
              title={`Скорость: ${speed}x. Тап — смена`}
              aria-label={`Скорость воспроизведения ${speed}x`}
            >
              {Number.isFinite(duration) && duration > 0 ? formatTime(duration) : "0:00"}
              {speed !== 1 && <span className="ml-0.5 opacity-70 text-[10px]">·{speed}x</span>}
            </TapScaleButton>
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
