/**
 * PULSE mobile DM: панели записи голоса, предпросмотра голоса, записи и превью видеокружка.
 * Разметка и поведение по voice-message-snippet.tsx; отправка через колбэки из useSendMessage.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Mic, Play, Send, Trash2, X } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { playPulseUiTone } from "@/lib/chat-pulse-ui-sound";
import type { VoiceRecorderState } from "@/hooks/useVoiceRecorder";
import { registerChatMessageMediaPlaybackPauser } from "@/features/chat/chat-message-media-playback-interrupt";
const BARS: number[] = Array.from({ length: 40 }, (_, i) =>
  3 + Math.abs(Math.sin(i * 0.6 + 1.3) * 10 + Math.sin(i * 1.7) * 4),
);

export type PulseDmComposerMediaProps = {
  accentColor: string;
  reducedMotion: boolean;
  allowSound: boolean;
  voiceState: VoiceRecorderState;
  durationSec: number;
  voicePreviewUrl: string | null;
  voicePreviewDurationSec: number;
  voiceSupported: boolean;
  sendingVoice: boolean;
  discardVoiceRecording: () => void | Promise<void>;
  finishVoiceRecordingClick: () => void | Promise<void>;
  cancelVoicePreview: () => void;
  sendRecordedVoice: () => void | Promise<void>;
  rerecordVoiceFromPreview: () => void | Promise<void>;
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function PulseDmComposerMedia({
  accentColor,
  reducedMotion,
  allowSound,
  voiceState,
  durationSec,
  voicePreviewUrl,
  voicePreviewDurationSec,
  voiceSupported,
  sendingVoice,
  discardVoiceRecording,
  finishVoiceRecordingClick,
  cancelVoicePreview,
  sendRecordedVoice,
  rerecordVoiceFromPreview,
}: PulseDmComposerMediaProps) {
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const acc = accentColor;
  const accSoft = acc.length === 7 && acc.startsWith("#") ? `${acc}28` : "rgba(129,140,248,0.16)";

  /* Сброс локального UI при смене фазы */
  useEffect(() => {
    if (!voicePreviewUrl) {
      setPreviewPlaying(false);
      setPreviewProgress(0);
    }
  }, [voicePreviewUrl]);

  /* Аудио-превью: прогресс от <audio> */
  const syncAudioProgress = useCallback(() => {
    const a = audioRef.current;
    if (!a?.duration || !Number.isFinite(a.duration)) return;
    setPreviewProgress(a.currentTime / a.duration);
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !voicePreviewUrl) return;
    if (previewPlaying) {
      void a.play().catch(() => setPreviewPlaying(false));
    } else {
      a.pause();
    }
  }, [previewPlaying, voicePreviewUrl]);

  useEffect(() => {
    return registerChatMessageMediaPlaybackPauser(() => {
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
      setPreviewPlaying(false);
      setPreviewProgress(0);
    });
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !voicePreviewUrl) return;
    const onEnded = () => {
      setPreviewPlaying(false);
      setPreviewProgress(0);
    };
    a.addEventListener("timeupdate", syncAudioProgress);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", syncAudioProgress);
      a.removeEventListener("ended", onEnded);
    };
  }, [voicePreviewUrl, syncAudioProgress]);

  /* Fallback-симуляция прогресса аудио, если duration ещё 0 */
  useEffect(() => {
    if (!previewPlaying || !voicePreviewUrl) return;
    const d = voicePreviewDurationSec;
    if (d > 0) return;
    const step = 0.008;
    const t = setInterval(() => {
      setPreviewProgress((p) => {
        if (p >= 1) {
          setPreviewPlaying(false);
          return 0;
        }
        return p + step;
      });
    }, 200);
    return () => clearInterval(t);
  }, [previewPlaying, voicePreviewUrl, voicePreviewDurationSec]);

  /* ── D1 запись голоса ── */
  if (voiceSupported && voiceState === "recording") {
    return (
      <div className="relative w-full pb-6 pt-0.5">
        <div className="flex justify-end pr-4 pb-0.5 pt-1">
          <div
            className={cn("flex flex-col items-center gap-1", !reducedMotion && "animate-bounce")}
            style={!reducedMotion ? { animationDuration: "1.8s" } : undefined}
          >
            <Lock className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)" }} aria-hidden />
            <div className="h-2.5 w-px bg-white/12" aria-hidden />
          </div>
        </div>
        <div className="flex items-center gap-2 px-1">
          <TapScaleButton
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
            aria-label="Отменить запись"
            onClick={() => {
              playPulseUiTone("soft_tick", allowSound);
              void discardVoiceRecording();
            }}
          >
            <Trash2 className="h-4 w-4 text-white/40" aria-hidden />
          </TapScaleButton>
          <div
            className="flex h-11 min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-full px-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}
          >
            <div
              className="h-2 w-2 shrink-0 rounded-full bg-red-500"
              style={reducedMotion ? undefined : { animation: "pulse-dm-recPulse 1s ease-in-out infinite" }}
              aria-hidden
            />
            <span className="min-w-[2.25rem] font-mono text-[13px] font-medium text-white/82 tabular-nums">
              {formatClock(durationSec)}
            </span>
            <div className="flex h-5 min-w-0 flex-1 items-center gap-[2.5px] overflow-hidden">
              {BARS.slice(0, 20).map((h, i) => (
                <div
                  key={i}
                  className="min-w-0 flex-1 rounded-full"
                  style={{
                    height: Math.max(2, (h / 15) * 18),
                    background: `rgba(239,68,68,${0.5 + 0.5 * Math.sin(Date.now() / 300 + i)})`,
                    animation: reducedMotion
                      ? undefined
                      : `pulse-dm-sndBar ${0.5 + i * 0.04}s ease-in-out ${i * 0.07}s infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span
              className="shrink-0 text-[10px] text-white/30"
              style={reducedMotion ? undefined : { animation: "pulse-dm-slideHint 1.2s ease-in-out infinite" }}
              aria-hidden
            >
              ←
            </span>
          </div>
          <TapScaleButton
            type="button"
            haptic
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "#ef4444",
              animation: reducedMotion ? undefined : "pulse-dm-recPulse 1.2s ease-in-out infinite",
            }}
            aria-label="Завершить запись"
            onClick={() => {
              playPulseUiTone("stt_done", allowSound);
              void finishVoiceRecordingClick();
            }}
          >
            <Mic className="h-[18px] w-[18px] text-white" aria-hidden />
          </TapScaleButton>
        </div>
        <p className="pb-1 pt-0.5 text-center text-[9.5px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          Удержите для блокировки · Отпустите для отправки
        </p>
      </div>
    );
  }

  /* ── D3 предпросмотр голоса ── */
  if (voicePreviewUrl) {
    const dur = voicePreviewDurationSec;
    return (
      <div
        className="relative w-full pb-6"
        style={reducedMotion ? undefined : { animation: "pulse-dm-previewIn 0.3s cubic-bezier(0.34,1.2,0.64,1)" }}
      >
        <audio ref={audioRef} src={voicePreviewUrl} preload="metadata" className="sr-only" />
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <span className="text-[11px] font-medium" style={{ color: acc }}>
            Предпросмотр записи
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30">{dur > 0 ? formatClock(dur) : "0:00"}</span>
            <TapScaleButton
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.07]"
              aria-label="Закрыть предпросмотр записи"
              onClick={() => {
                setPreviewPlaying(false);
                setPreviewProgress(0);
                cancelVoicePreview();
              }}
            >
              <X className="h-3 w-3 text-white/40" />
            </TapScaleButton>
          </div>
        </div>
        <div
          className="mx-1 mb-2 overflow-hidden rounded-2xl"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${acc}40` }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="relative shrink-0" style={{ width: 42, height: 42 }}>
              <svg width="42" height="42" className="absolute inset-0" style={{ transform: "rotate(-90deg)" }} aria-hidden>
                <circle cx="21" cy="21" r="18" fill="none" stroke={accSoft} strokeWidth="2.5" />
                <circle
                  cx="21"
                  cy="21"
                  r="18"
                  fill="none"
                  stroke={acc}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - previewProgress)}`}
                  style={{ transition: "stroke-dashoffset 0.18s linear" }}
                />
              </svg>
              <TapScaleButton
                type="button"
                haptic
                className="absolute inset-0 flex items-center justify-center rounded-full transition-all"
                style={{ background: previewPlaying ? acc : `${acc}22` }}
                aria-label={previewPlaying ? "Пауза" : "Воспроизвести"}
                onClick={() => setPreviewPlaying((p) => !p)}
              >
                {previewPlaying ? (
                  <div className="flex gap-[2.5px]">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-sm bg-white"
                        style={{
                          width: 2.5,
                          height: 11,
                          animation: reducedMotion
                            ? undefined
                            : `pulse-dm-sndBar 0.55s ease-in-out ${i * 0.14}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Play className="ml-0.5 h-3.5 w-3.5 text-white" aria-hidden />
                )}
              </TapScaleButton>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div
                role="slider"
                aria-valuenow={Math.round(previewProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="flex h-8 cursor-pointer items-center gap-[2px]"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                  setPreviewProgress(p);
                  const a = audioRef.current;
                  if (a?.duration && Number.isFinite(a.duration)) a.currentTime = p * a.duration;
                }}
              >
                {BARS.map((h, i) => {
                  const played = i / BARS.length < previewProgress;
                  return (
                    <div
                      key={i}
                      className="min-w-0 flex-1 rounded-full transition-colors duration-150"
                      style={{
                        height: Math.max(2, (h / 15) * 28),
                        background: played ? acc : `${acc}44`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-0.5">
                <span className="font-mono text-[10px] text-white/30">
                  {dur > 0 ? `${Math.floor(previewProgress * dur)}с` : `${Math.floor(previewProgress * 100)}%`}
                </span>
                <span className="font-mono text-[10px] text-white/20">{dur > 0 ? formatClock(dur) : "—"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-1">
          <TapScaleButton
            type="button"
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-medium text-red-400"
            style={{ background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.28)" }}
            onClick={() => {
              setPreviewPlaying(false);
              setPreviewProgress(0);
              cancelVoicePreview();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Удалить
          </TapScaleButton>
          <TapScaleButton
            type="button"
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-white"
            style={{ background: acc, boxShadow: `0 0 18px ${acc}88` }}
            disabled={sendingVoice}
            haptic
            onClick={() => void sendRecordedVoice()}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {sendingVoice ? "…" : "Отправить"}
          </TapScaleButton>
        </div>
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            className="text-[11px] text-white/35 underline decoration-white/20 underline-offset-2"
            disabled={sendingVoice}
            onClick={() => void rerecordVoiceFromPreview()}
          >
            Перезаписать
          </button>
        </div>
      </div>
    );
  }

  return null;
}
