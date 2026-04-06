import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Lock, Pause, Play, SwitchCamera, Zap, ZapOff } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { isNative } from "@/lib/capacitor-native";
import { formatVideoNoteTime } from "./format-video-note-time";
import { VIDEO_NOTE_MAX_DURATION_SEC } from "@/features/chat/constants";

/** Полноэкранный предпросмотр голосового перед отправкой (не PULSE DM медиа-режим). */
export function ChatDetailVoicePreviewModal({
  previewUrl,
  durationSec,
  sendingVoice,
  onDelete,
  onRerecord,
  onSend,
}: {
  previewUrl: string;
  durationSec: number;
  sendingVoice: boolean;
  onDelete: () => void;
  onRerecord: () => void;
  onSend: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[141] flex flex-col items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Предпросмотр голосового сообщения"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-background/90 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Голосовое сообщение</p>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatVideoNoteTime(durationSec)}</span>
        </div>
        <audio src={previewUrl} controls className="mb-4 w-full" preload="metadata" />
        <div className="flex flex-wrap gap-2">
          <TapScaleButton
            type="button"
            onClick={onDelete}
            className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 rounded-xl border border-input bg-background"
          >
            Удалить
          </TapScaleButton>
          <TapScaleButton
            type="button"
            onClick={onRerecord}
            disabled={sendingVoice}
            className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 rounded-xl bg-secondary text-foreground disabled:opacity-50"
          >
            Перезаписать
          </TapScaleButton>
          <TapScaleButton
            type="button"
            onClick={onSend}
            disabled={sendingVoice}
            haptic
            className="min-h-[var(--uix-touch-min)] min-w-0 flex-[1.15] rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sendingVoice ? "…" : "Отправить"}
          </TapScaleButton>
        </div>
      </div>
    </div>
  );
}

export type ChatDetailVideoNotePhase = "recording" | "preview";

/** Запись / превью видеокружка: круг как в чате, квадратный кроп совпадает с записью (useSendMessage). */
export function ChatDetailVideoNoteModal({
  phase,
  durationSec,
  locked,
  lockProgress,
  cancelProgress,
  facingUser,
  previewUrl,
  softLightEnabled,
  softLightAvailable,
  liveBackgroundStream,
  onSoftLightToggle,
  setLiveVideoRef,
  onFlipCamera,
  onCancel,
  onStopRecording,
  onRerecord,
  onSend,
}: {
  phase: ChatDetailVideoNotePhase;
  durationSec: number;
  locked: boolean;
  lockProgress: number;
  cancelProgress: number;
  facingUser: boolean;
  previewUrl: string | null;
  softLightEnabled: boolean;
  /** Показывать кнопку подсветки (только селфи-камера, во время записи). */
  softLightAvailable: boolean;
  /** Живой поток для размытого фона во время записи. */
  liveBackgroundStream: MediaStream | null;
  onSoftLightToggle: () => void;
  setLiveVideoRef: (el: HTMLVideoElement | null) => void;
  onFlipCamera: () => void;
  onCancel: () => void;
  onStopRecording: () => void;
  onRerecord: () => void;
  onSend: () => void;
}) {
  const recordProgress = Math.min(1, durationSec / Math.max(1, VIDEO_NOTE_MAX_DURATION_SEC));
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveBackdropVideoRef = useRef<HTMLVideoElement | null>(null);
  const [previewPaused, setPreviewPaused] = useState(true);

  const webScreenFillLight =
    softLightEnabled && facingUser && phase === "recording" && !isNative();

  useEffect(() => {
    const v = liveBackdropVideoRef.current;
    if (!v) return;
    if (phase === "recording" && liveBackgroundStream) {
      v.srcObject = liveBackgroundStream;
      v.muted = true;
      v.playsInline = true;
      void v.play().catch(() => {});
    } else {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      v.srcObject = null;
    }
  }, [phase, liveBackgroundStream]);

  useEffect(() => {
    if (phase !== "preview") return;
    setPreviewPaused(true);
    const v = previewVideoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    }
  }, [phase, previewUrl]);

  const togglePreviewPlayback = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const circleShell =
    "relative z-[12] aspect-square w-[min(92vw,calc(100dvh-12rem),26rem)] shrink-0 overflow-hidden rounded-full bg-black shadow-2xl ring-2 ring-white/20";

  const cameraToolbarBtn =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md hover:bg-black/55 active:scale-[0.97]";

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={phase === "recording" ? "Запись видеокружка" : "Предпросмотр видеокружка"}
    >
      {phase === "recording" ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-1 bg-white/10"
          style={{ paddingLeft: "env(safe-area-inset-top, 0px)" }}
          aria-hidden
        >
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${recordProgress * 100}%` }}
          />
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-neutral-950">
        {phase === "recording" && liveBackgroundStream ? (
          <video
            ref={liveBackdropVideoRef}
            className="pointer-events-none absolute inset-0 z-0 min-h-[115%] min-w-[115%] object-cover opacity-[0.72] blur-3xl"
            style={facingUser ? { transform: "scaleX(-1)" } : undefined}
            muted
            playsInline
            aria-hidden
          />
        ) : null}
        {phase === "preview" && previewUrl ? (
          <video
            key={previewUrl}
            src={previewUrl}
            className="pointer-events-none absolute inset-0 z-0 min-h-[115%] min-w-[115%] object-cover opacity-[0.65] blur-3xl"
            muted
            playsInline
            autoPlay
            loop
            aria-hidden
          />
        ) : null}
        {!(phase === "recording" && liveBackgroundStream) && !(phase === "preview" && previewUrl) ? (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-indigo-950/85 via-neutral-950 to-violet-950/75"
            aria-hidden
          />
        ) : null}

        {webScreenFillLight ? (
          <div
            className="pointer-events-none absolute inset-0 z-[4] bg-white"
            style={{ opacity: 0.42 }}
            aria-hidden
          />
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-black/45 via-transparent to-black/55",
            webScreenFillLight && "from-black/15 via-transparent to-black/25",
          )}
          aria-hidden
        />

        <div className="relative z-[12] flex min-h-0 w-full flex-1 flex-col items-center justify-center px-3">
          <div className={circleShell}>
            {phase === "recording" ? (
              <video
                ref={setLiveVideoRef}
                className="absolute inset-0 h-full w-full object-cover"
                style={facingUser ? { transform: "scaleX(-1)" } : undefined}
                autoPlay
                muted
                playsInline
              />
            ) : previewUrl ? (
              <>
                <video
                  ref={previewVideoRef}
                  src={previewUrl}
                  className="absolute inset-0 h-full w-full object-cover"
                  playsInline
                  preload="auto"
                  onPlay={() => setPreviewPaused(false)}
                  onPause={() => setPreviewPaused(true)}
                  onEnded={() => setPreviewPaused(true)}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    try {
                      if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
                        el.currentTime = Math.min(0.001, el.duration - 0.05);
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                />
                <TapScaleButton
                  type="button"
                  haptic
                  className={cn(
                    "absolute inset-0 z-[1] flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center text-white transition-colors",
                    previewPaused
                      ? "bg-black/35"
                      : "bg-transparent opacity-0 active:bg-black/25 active:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/40",
                  )}
                  aria-label={previewPaused ? "Воспроизвести предпросмотр" : "Пауза предпросмотра"}
                  onClick={togglePreviewPlayback}
                >
                  {previewPaused ? (
                    <Play className="h-14 w-14 drop-shadow-md" fill="currentColor" aria-hidden />
                  ) : (
                    <Pause className="h-11 w-11 drop-shadow-md opacity-90" aria-hidden />
                  )}
                </TapScaleButton>
              </>
            ) : null}
          </div>

          {phase === "recording" ? (
            <div className="absolute bottom-4 left-4 z-[14] flex items-center gap-2 sm:bottom-5">
              <TapScaleButton
                type="button"
                haptic
                className={cameraToolbarBtn}
                aria-label="Переключить камеру"
                onClick={() => void onFlipCamera()}
              >
                <SwitchCamera className="h-6 w-6" aria-hidden />
              </TapScaleButton>
              {softLightAvailable ? (
                <TapScaleButton
                  type="button"
                  haptic
                  className={cn(
                    cameraToolbarBtn,
                    softLightEnabled ? "border-amber-300/70 bg-amber-500/20 text-amber-50" : "",
                  )}
                  aria-label={
                    softLightEnabled ? "Выключить подсветку экраном" : "Включить подсветку экраном (селфи)"
                  }
                  aria-pressed={softLightEnabled}
                  onClick={onSoftLightToggle}
                >
                  {softLightEnabled ? (
                    <Zap className="h-6 w-6" aria-hidden />
                  ) : (
                    <ZapOff className="h-6 w-6" aria-hidden />
                  )}
                </TapScaleButton>
              ) : null}
            </div>
          ) : null}

          {phase === "recording" && !locked ? (
            <div className="pointer-events-none absolute right-4 top-1/2 z-[14] -translate-y-1/2" aria-hidden>
              <div className="relative h-28 w-6 rounded-full border border-white/20 bg-black/45 p-1 backdrop-blur">
                <div className="absolute inset-x-2 bottom-2 top-2 rounded-full bg-white/15" />
                <div
                  className="absolute inset-x-2 bottom-2 rounded-full bg-primary/90 transition-[height] duration-100 ease-out"
                  style={{ height: `${Math.max(0, Math.min(1, lockProgress)) * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          {phase === "recording" && !locked ? (
            <div className="pointer-events-none absolute bottom-5 left-1/2 z-[14] -translate-x-1/2" aria-hidden>
              <div className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur">
                <div className="mb-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-red-400 transition-[width] duration-100 ease-out"
                    style={{ width: `${Math.max(0, Math.min(1, cancelProgress)) * 100}%` }}
                  />
                </div>
                <span>Свайп влево — отмена</span>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent"
          style={{
            height: "calc(5.5rem + env(safe-area-inset-top, 0px))",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
          aria-hidden
        />
      </div>

      <div
        className="relative z-30 flex flex-col gap-3 border-t border-white/10 bg-black/80 px-4 pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between gap-2 text-white/90">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {phase === "recording" ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                <span>{formatVideoNoteTime(durationSec)}</span>
                <span className="text-white/40">/ {formatVideoNoteTime(VIDEO_NOTE_MAX_DURATION_SEC)}</span>
              </span>
            ) : (
              <span className="text-sm font-medium">Предпросмотр</span>
            )}
          </div>
        </div>

        {phase === "recording" ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
            {locked ? (
              <span className="inline-flex items-center gap-1 font-medium text-white">
                <Lock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                Запись закреплена
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Вверх — закрепить; влево — отменить; отпускание — стоп
              </span>
            )}
          </div>
        ) : null}

        {phase === "recording" ? (
          <div className="flex gap-2">
            <TapScaleButton
              type="button"
              onClick={onCancel}
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl border border-white/20 bg-white/10 text-white"
            >
              Отмена
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={onStopRecording}
              haptic
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-primary text-primary-foreground"
            >
              Стоп
            </TapScaleButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <TapScaleButton
              type="button"
              onClick={onCancel}
              className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 text-white"
            >
              Удалить
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={onRerecord}
              className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 rounded-xl bg-white/15 text-white"
            >
              Перезаписать
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={onSend}
              haptic
              className="min-h-[var(--uix-touch-min)] min-w-0 flex-[1.1] rounded-xl bg-primary text-primary-foreground"
            >
              Отправить
            </TapScaleButton>
          </div>
        )}
      </div>
    </div>
  );
}
