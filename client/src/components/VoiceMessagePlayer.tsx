import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-base";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  src: string;
  isMe?: boolean;
  className?: string;
};

export function VoiceMessagePlayer({ src, isMe = true, className }: Props) {
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
    const onLoadedMetadata = () => {
      const d = el.duration;
      setDuration(Number.isFinite(d) && d >= 0 ? d : 0);
      setLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
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
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  const setAudioSrc = useCallback(async (): Promise<boolean> => {
    const el = audioRef.current;
    if (!el || !src) return false;
    if (hasSetSrcRef.current) return true;
    try {
      // Prefer native media loading via <audio src>, avoids CORS/auth fetch issues on iOS/Capacitor.
      el.src = src;
      hasSetSrcRef.current = true;
      return true;
    } catch {
      setLoadError(true);
      return false;
    }
  }, [src]);

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
    el.play().catch(() => setLoadError(true));
    setPlaying(true);
  }, [playing, setAudioSrc]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = pct * duration;
    setCurrentTime(el.currentTime);
  };

  if (loadError) {
    return (
      <div
        className={cn(
          "rounded-lg px-2 py-1.5 min-h-[32px] flex items-center gap-1.5 text-muted-foreground text-[11px]",
          isMe ? "bg-white/15" : "bg-muted/70 border border-border/50",
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
        "inline-flex flex-col min-w-[100px] max-w-[220px] w-fit",
        className
      )}
    >
      <audio ref={audioRef} preload="none" playsInline />
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1.5 min-h-[32px]",
          isMe
            ? "bg-[#E7FCE0] dark:bg-[#1D3B1D] shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
            : "bg-muted/70 border border-border/50 shadow-sm"
        )}
      >
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-95",
            isMe
              ? "bg-[#2E7D32] text-white hover:bg-[#1B5E20] dark:bg-[#4CAF50] dark:hover:bg-[#66BB6A]"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? (
            <Pause className="w-3 h-3 fill-current" />
          ) : (
            <Play className="w-3 h-3 fill-current ml-0.5" />
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
                "text-[10px] font-medium tabular-nums flex-shrink-0 w-6",
                isMe ? "text-[#2E7D32] dark:text-[#A5D6A7]" : "text-foreground/90"
              )}
            >
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative h-0.5 rounded-full overflow-visible min-w-[40px]">
              <div
                className={cn(
                  "absolute inset-0 rounded-full",
                  isMe ? "bg-[#2E7D32]/25 dark:bg-white/20" : "bg-muted-foreground/20"
                )}
              />
              <div
                className={cn(
                  "absolute left-0 top-0 h-full rounded-full transition-[width] duration-75",
                  isMe ? "bg-[#2E7D32] dark:bg-[#81C784]" : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              />
              <div
                className={cn(
                  "absolute top-1/2 left-0 w-1.5 h-1.5 rounded-full border border-current transition-[left] duration-75 -translate-y-1/2 -translate-x-1/2",
                  isMe ? "bg-[#2E7D32] border-[#1B5E20]/50 dark:bg-[#81C784] dark:border-[#4CAF50]/50" : "bg-primary border-primary-foreground/30"
                )}
                style={{ left: `${progress}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-medium tabular-nums flex-shrink-0 w-6 text-right",
                isMe ? "text-[#2E7D32] dark:text-[#A5D6A7]" : "text-muted-foreground"
              )}
            >
              {loaded && Number.isFinite(duration) ? formatTime(duration) : "0:00"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
