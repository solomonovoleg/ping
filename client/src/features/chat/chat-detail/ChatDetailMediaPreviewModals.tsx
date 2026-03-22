import { Lock, ArrowUp } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
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

/** Полноэкранная запись / превью видеокружка (не PULSE DM). */
export function ChatDetailVideoNoteModal({
  phase,
  durationSec,
  locked,
  previewUrl,
  setLiveVideoRef,
  onCancel,
  onStopRecording,
  onRerecord,
  onSend,
}: {
  phase: ChatDetailVideoNotePhase;
  durationSec: number;
  locked: boolean;
  previewUrl: string | null;
  setLiveVideoRef: (el: HTMLVideoElement | null) => void;
  onCancel: () => void;
  onStopRecording: () => void;
  onRerecord: () => void;
  onSend: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm px-4 py-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-background/90 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {phase === "recording" ? "Запись видеокружка" : "Просмотр видеокружка"}
          </p>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              <span className="text-foreground/90">{formatVideoNoteTime(durationSec)}</span>
              {phase === "recording" ? (
                <span className="text-muted-foreground/80"> / {formatVideoNoteTime(VIDEO_NOTE_MAX_DURATION_SEC)}</span>
              ) : null}
            </span>
            {phase === "recording" ? (
              <span className="text-[10px] text-muted-foreground">Максимум {VIDEO_NOTE_MAX_DURATION_SEC} с</span>
            ) : null}
          </div>
        </div>
        {phase === "recording" && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border/60 bg-muted/50 px-3 py-2 text-xs">
            {locked ? (
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <Lock className="h-3.5 w-3.5" />
                Запись закреплена
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ArrowUp className="h-3.5 w-3.5" />
                Свайп вверх, чтобы закрепить
              </span>
            )}
            <span className="text-muted-foreground">Отпускание: {locked ? "не останавливает" : "остановит"}</span>
          </div>
        )}
        <div className="mx-auto mb-4 flex items-center justify-center">
          <div className="relative h-[240px] w-[240px]">
            {phase === "recording" && (
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  padding: "4px",
                  background:
                    "conic-gradient(from 0deg, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.95))",
                }}
                aria-hidden
              >
                <div className="h-full w-full rounded-full bg-transparent" />
              </div>
            )}
            <div className="absolute inset-[6px] overflow-hidden rounded-full bg-black">
              {phase === "recording" ? (
                <video
                  ref={setLiveVideoRef}
                  className="h-full w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                  autoPlay
                  muted
                  playsInline
                />
              ) : previewUrl ? (
                <video
                  src={previewUrl}
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : null}
            </div>
          </div>
        </div>
        {phase === "recording" ? (
          <div className="flex gap-2">
            <TapScaleButton
              type="button"
              onClick={onCancel}
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl border border-input bg-background"
            >
              Отмена
            </TapScaleButton>
            <TapScaleButton type="button" onClick={onStopRecording} haptic className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-primary text-primary-foreground">
              Стоп
            </TapScaleButton>
          </div>
        ) : (
          <div className="flex gap-2">
            <TapScaleButton
              type="button"
              onClick={onCancel}
              className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl border border-input bg-background"
            >
              Удалить
            </TapScaleButton>
            <TapScaleButton type="button" onClick={onRerecord} className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-secondary text-foreground">
              Перезаписать
            </TapScaleButton>
            <TapScaleButton type="button" onClick={onSend} haptic className="min-h-[var(--uix-touch-min)] flex-1 rounded-xl bg-primary text-primary-foreground">
              Отправить
            </TapScaleButton>
          </div>
        )}
      </div>
    </div>
  );
}
