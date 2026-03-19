import { useEffect, useRef, useState } from "react";
import { PhoneOff, Phone, Mic, MicOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallState, IncomingCallInfo } from "@/features/call/call-types";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { UserAvatar } from "@/components/UserAvatar";

type Props = {
  state: CallState;
  isVideo: boolean;
  isMuted: boolean;
  onSetMuted: (m: boolean) => void;
  onEndCall: () => void;
  onAccept: () => void;
  onReject: () => void;
  incoming: IncomingCallInfo | null;
  error: string | null;
  statusText: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  onRetry?: () => void;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  otherUserId: string | null;
};

const STATE_LABELS: Partial<Record<CallState, string>> = {
  outgoing_ringing: "Вызов...",
  incoming_ringing: "Входящий звонок",
  accepting: "Подключение...",
  connecting: "Подключение...",
  reconnecting: "Восстановление соединения...",
  ended: "Звонок завершён",
  rejected: "Отклонено",
  missed: "Не ответили",
  busy: "Абонент занят",
  failed: "Соединение не установлено",
};

const ACTIVE_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "outgoing_ringing", "accepting", "connecting", "connected", "reconnecting",
]);

const SHOW_MODAL_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "outgoing_ringing", "incoming_ringing", "accepting", "connecting",
  "connected", "reconnecting", "failed", "ended", "rejected", "missed", "busy",
]);

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function CallModal({
  state,
  isVideo,
  isMuted,
  onSetMuted,
  onEndCall,
  onAccept,
  onReject,
  incoming,
  error,
  statusText,
  localStream,
  remoteStream,
  connectionState,
  onRetry,
  otherDisplayName,
  otherAvatarUrl,
  otherUserId,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteNeedsTapToPlay, setRemoteNeedsTapToPlay] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call duration timer
  useEffect(() => {
    if (state === "connected" || state === "reconnecting") {
      if (!timerRef.current) {
        setCallDuration(0);
        timerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (state === "idle") setCallDuration(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localStream) return;
    el.srcObject = localStream;
    return () => { el.srcObject = null; };
  }, [localStream, state]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    const tryPlay = async () => {
      try {
        await el.play();
        setRemoteNeedsTapToPlay(false);
      } catch {
        setRemoteNeedsTapToPlay(true);
      }
    };
    tryPlay();
    return () => {
      el.srcObject = null;
      setRemoteNeedsTapToPlay(false);
    };
  }, [remoteStream, state]);

  if (!SHOW_MODAL_STATES.has(state) && !incoming) return null;

  const label = STATE_LABELS[state] ?? "";
  const poorConnection = state === "connected" && (connectionState === "disconnected" || connectionState === "failed");
  const isTerminal = state === "ended" || state === "rejected" || state === "missed" || state === "busy" || state === "failed";
  const showActiveControls = ACTIVE_STATES.has(state);
  const showVideo = isVideo && state === "connected";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white">
      {/* Status banners */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-destructive/90 text-sm max-w-[90%] text-center z-10">
          {error}
        </div>
      )}
      {statusText && !error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-white/20 text-sm max-w-[90%] text-center z-10">
          {statusText}
        </div>
      )}
      {poorConnection && !error && !statusText && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-amber-600/90 text-sm z-10">
          {connectionState === "disconnected" ? "Плохое соединение. Восстановление…" : "Соединение прервано"}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 relative flex items-center justify-center min-h-0">
        {/* Remote video (full screen, only when connected + video) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn("w-full h-full object-contain", !showVideo && "hidden")}
        />

        {/* Avatar + name + status (for non-video or non-connected states) */}
        {!showVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
            <UserAvatar
              avatarUrl={otherAvatarUrl}
              displayName={otherDisplayName}
              seed={otherUserId ?? undefined}
              size={96}
              className="w-24 h-24 rounded-full shadow-xl border-2 border-white/20"
            />
            <p className="text-xl font-semibold text-center mt-2">{otherDisplayName}</p>

            {/* State label or timer */}
            {state === "connected" && (
              <p className="text-base text-white/70 tabular-nums">{formatDuration(callDuration)}</p>
            )}
            {state === "reconnecting" && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-amber-400">{label}</p>
                <p className="text-base text-white/70 tabular-nums">{formatDuration(callDuration)}</p>
              </div>
            )}
            {state !== "connected" && state !== "reconnecting" && label && (
              <p className="text-sm text-white/60">{label}</p>
            )}
          </div>
        )}
      </div>

      {/* Video: timer overlay + local PiP */}
      {showVideo && (
        <>
          <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-sm tabular-nums z-10">
            {formatDuration(callDuration)}
          </div>
          <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
        </>
      )}

      {/* Controls */}
      <div className="shrink-0 p-6 flex justify-center gap-6 items-center">
        {state === "connected" && remoteNeedsTapToPlay && (
          <TapScaleButton
            type="button"
            onClick={async () => {
              const el = remoteVideoRef.current;
              if (!el) return;
              try { await el.play(); setRemoteNeedsTapToPlay(false); } catch { setRemoteNeedsTapToPlay(true); }
            }}
            className="px-4 py-2 rounded-xl bg-primary/90 text-primary-foreground text-sm font-medium"
            aria-label="Включить звук собеседника"
          >
            Включить звук
          </TapScaleButton>
        )}

        {state === "incoming_ringing" && (
          <>
            <TapScaleButton
              type="button"
              onClick={onReject}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Отклонить"
              haptic
            >
              <PhoneOff className="w-8 h-8" />
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={onAccept}
              className="p-4 rounded-full bg-green-600 hover:bg-green-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Принять"
              haptic
            >
              <Phone className="w-8 h-8" />
            </TapScaleButton>
          </>
        )}

        {showActiveControls && (
          <>
            <TapScaleButton
              type="button"
              onClick={() => onSetMuted(!isMuted)}
              className={cn(
                "p-4 rounded-full transition-colors min-h-[var(--uix-touch-min)]",
                isMuted ? "bg-red-600/80 hover:bg-red-600" : "bg-white/20 hover:bg-white/30",
              )}
              aria-label={isMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={onEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Завершить"
              haptic
            >
              <PhoneOff className="w-8 h-8" />
            </TapScaleButton>
          </>
        )}

        {state === "failed" && (
          <>
            <TapScaleButton
              type="button"
              onClick={onRetry}
              className="p-4 rounded-full bg-green-600 hover:bg-green-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Позвонить снова"
              haptic
            >
              <RefreshCw className="w-8 h-8" />
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={onEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Закрыть"
              haptic
            >
              <PhoneOff className="w-8 h-8" />
            </TapScaleButton>
          </>
        )}

        {isTerminal && state !== "failed" && (
          <TapScaleButton
            type="button"
            onClick={onEndCall}
            className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors min-h-[var(--uix-touch-min)]"
            aria-label="Закрыть"
            haptic
          >
            <PhoneOff className="w-8 h-8" />
          </TapScaleButton>
        )}
      </div>
    </div>
  );
}
