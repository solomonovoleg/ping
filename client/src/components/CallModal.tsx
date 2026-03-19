import { useEffect, useRef, useState } from "react";
import { PhoneOff, Phone, Mic, MicOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallState } from "@/hooks/useCall";
import { TapScaleButton } from "@/components/ui/tap-scale";

type IncomingInfo = {
  fromUserId: string;
  fromDisplayName: string | null;
  chatId: string;
  video: boolean;
};

type Props = {
  state: CallState;
  isVideo: boolean;
  isMuted: boolean;
  onSetMuted: (m: boolean) => void;
  onEndCall: () => void;
  onAccept: () => void;
  onReject: () => void;
  incoming: IncomingInfo | null;
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  onRetry?: () => void;
};

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
  localStream,
  remoteStream,
  connectionState,
  onRetry,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteNeedsTapToPlay, setRemoteNeedsTapToPlay] = useState(false);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localStream) return;
    el.srcObject = localStream;
    return () => {
      el.srcObject = null;
    };
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
        // iOS Safari/WebView иногда блокирует autoplay удалённого аудио до явного user gesture.
        setRemoteNeedsTapToPlay(true);
      }
    };
    tryPlay();
    return () => {
      el.srcObject = null;
      setRemoteNeedsTapToPlay(false);
    };
  }, [remoteStream, state]);

  if (state === "idle" && !incoming) return null;

  const name = incoming?.fromDisplayName ?? "Абонент";
  const poorConnection = state === "in-call" && (connectionState === "disconnected" || connectionState === "failed");

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-destructive/90 text-sm max-w-[90%] text-center">
          {error}
        </div>
      )}
      {poorConnection && !error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-amber-600/90 text-sm">
          {connectionState === "disconnected" ? "Плохое соединение. Восстановление…" : "Соединение прервано"}
        </div>
      )}

      {/* Удалённое видео (или заглушка) */}
      <div className="flex-1 relative flex items-center justify-center min-h-0">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn("w-full h-full object-contain", !isVideo && "hidden")}
        />
        {(!isVideo || state === "calling" || state === "ringing" || state === "connecting" || state === "failed") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl">
              {state === "ringing" || state === "calling" || state === "connecting" ? "👤" : state === "failed" ? "⚠️" : null}
            </div>
            <p className="text-lg font-medium text-center px-4">
              {state === "calling" && "Вызов..."}
              {state === "ringing" && `${name}`}
              {state === "connecting" && "Подключение..."}
              {state === "in-call" && !isVideo && name}
              {state === "failed" && "Соединение не установлено"}
            </p>
          </div>
        )}
      </div>

      {/* Локальное видео (маленькое) */}
      {isVideo && state === "in-call" && (
        <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>
      )}

      {/* Кнопки */}
      <div className="shrink-0 p-6 flex justify-center gap-6 items-center">
        {state === "in-call" && remoteNeedsTapToPlay && (
          <TapScaleButton
            type="button"
            onClick={async () => {
              const el = remoteVideoRef.current;
              if (!el) return;
              try {
                await el.play();
                setRemoteNeedsTapToPlay(false);
              } catch {
                setRemoteNeedsTapToPlay(true);
              }
            }}
            className="px-4 py-2 rounded-xl bg-primary/90 text-primary-foreground text-sm font-medium"
            aria-label="Включить звук собеседника"
          >
            Включить звук
          </TapScaleButton>
        )}
        {state === "ringing" && (
          <>
            <TapScaleButton
              type="button"
              onClick={() => onReject?.()}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Отклонить"
              haptic
            >
              <PhoneOff className="w-8 h-8" />
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={() => onAccept?.()}
              className="p-4 rounded-full bg-green-600 hover:bg-green-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Принять"
              haptic
            >
              <Phone className="w-8 h-8" />
            </TapScaleButton>
          </>
        )}
        {(state === "calling" || state === "connecting" || state === "in-call") && (
          <>
            <TapScaleButton
              type="button"
              onClick={() => onSetMuted?.(!isMuted)}
              className={cn(
                "p-4 rounded-full transition-colors min-h-[var(--uix-touch-min)]",
                isMuted ? "bg-red-600/80 hover:bg-red-600" : "bg-white/20 hover:bg-white/30"
              )}
              aria-label={isMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={() => onEndCall?.()}
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
              onClick={() => onRetry?.()}
              className="p-4 rounded-full bg-green-600 hover:bg-green-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Позвонить снова"
              haptic
            >
              <RefreshCw className="w-8 h-8" />
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={() => onEndCall?.()}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors min-h-[var(--uix-touch-min)]"
              aria-label="Завершить"
              haptic
            >
              <PhoneOff className="w-8 h-8" />
            </TapScaleButton>
          </>
        )}
      </div>
    </div>
  );
}
