import { useEffect, useRef, type CSSProperties } from "react";
import { MicOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase();
  const w = p[0] ?? name;
  return w.slice(0, 2).toUpperCase() || "?";
}

export type GroupParticipantTileAccent = { hex: string; gradient: string }

type Props = {
  displayName: string;
  userId: string;
  stream: MediaStream | null;
  streamRenderKey?: number;
  video: boolean;
  isSpeaking: boolean;
  mutePlayback: boolean;
  playbackVolume: number;
  isLocalTile?: boolean;
  /** UIX-GUIDELINES §2 — фиксированный акцент участника */
  accent: GroupParticipantTileAccent;
  /** GroupCall.tsx слой 7 — демо «слабый сигнал» для 3-го участника в списке */
  showPoorConnection?: boolean;
  size: "lg" | "sm";
  className?: string;
}

export function GroupParticipantTile({
  displayName,
  userId,
  stream,
  streamRenderKey = 0,
  video,
  isSpeaking,
  mutePlayback,
  playbackVolume,
  isLocalTile = false,
  accent,
  showPoorConnection = false,
  size,
  className,
}: Props) {
  const vRef = useRef<HTMLVideoElement>(null);
  const aRef = useRef<HTMLAudioElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const vol = mutePlayback ? 0 : Math.min(1, Math.max(0, playbackVolume));

  useEffect(() => {
    const el = vRef.current;
    if (!el) return;
    el.srcObject = stream && (stream.getVideoTracks().length > 0 || !video) ? stream : null;
    el.volume = vol;
    el.muted = mutePlayback || vol <= 0;
    if (stream?.getVideoTracks().length) {
      void el.play().catch(() => {});
    }
  }, [stream, video, streamRenderKey, mutePlayback, vol]);

  useEffect(() => {
    const el = aRef.current;
    if (!el || !stream) return;
    const at = stream.getAudioTracks()[0];
    if (!at) {
      el.srcObject = null;
      return;
    }
    el.srcObject = new MediaStream([at]);
    el.volume = vol;
    el.muted = mutePlayback || vol <= 0;
    void el.play().catch(() => {});
  }, [stream, mutePlayback, vol]);

  const showVideo = Boolean(video && stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled));
  const hasAudio = Boolean(stream?.getAudioTracks().some((t) => t.readyState === "live"));
  const audioMuted = Boolean(stream?.getAudioTracks()[0] && !stream.getAudioTracks()[0]!.enabled);
  const shortName = displayName.trim().split(/\s+/)[0] ?? displayName;

  const speakingPulseStyle: CSSProperties | undefined =
    isSpeaking && !reducedMotion ? { animation: "pulse 2s ease-in-out infinite" } : undefined

  return (
    <div
      data-user-id={userId}
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isSpeaking
          ? "border-white/30 shadow-[0_0_0_2px_rgba(255,255,255,0.25),0_0_24px_rgba(255,255,255,0.08)]"
          : "border-white/[0.07]",
        size === "lg" ? "min-h-0 flex-1" : "h-24 w-full",
        className,
      )}
      style={{ background: accent.gradient }}
    >
      {hasAudio && !showVideo ? (
        <audio
          ref={aRef}
          playsInline
          className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
          muted={mutePlayback || vol <= 0}
          aria-hidden
        />
      ) : null}

      {showVideo ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse 60% 70% at 50% 35%, ${accent.hex}33 0%, transparent 70%)`,
          }}
        />
      ) : null}

      {!showVideo ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div
            className={cn(
              "flex items-center justify-center rounded-full border-2 font-semibold text-white",
              size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm",
            )}
            style={{
              background: `${accent.hex}40`,
              borderColor: `${accent.hex}99`,
            }}
          >
            {initialsFromName(displayName)}
          </div>
        </div>
      ) : (
        <video
          ref={vRef}
          autoPlay
          playsInline
          muted={mutePlayback || vol <= 0}
          className="relative z-[1] h-full w-full object-cover"
        />
      )}

      {isSpeaking ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] rounded-2xl"
          style={{
            boxShadow: `inset 0 0 0 2px ${accent.hex}`,
            ...speakingPulseStyle,
          }}
        />
      ) : null}

      {showPoorConnection ? (
        <div className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
          <Wifi className="h-2.5 w-2.5 text-amber-400" aria-hidden />
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5">
        {isSpeaking ? (
          <div className="flex items-end gap-0.5 rounded-md bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-white"
                style={{
                  height: `${4 + i * 2}px`,
                  transformOrigin: "bottom center",
                  animation: reducedMotion
                    ? undefined
                    : `soundBar 0.8s ${i * 0.15}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        ) : null}
        <span
          className={cn(
            "truncate rounded-md bg-black/50 font-medium text-white backdrop-blur-sm",
            size === "lg" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[9px]",
          )}
        >
          {isLocalTile ? "Вы" : shortName}
        </span>
      </div>

      {audioMuted && hasAudio ? (
        <div className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
          <MicOff className="h-2.5 w-2.5 text-red-400" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
