import { useCallback, useEffect, useRef, useState } from "react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { playPulseUiTone } from "@/lib/chat-pulse-ui-sound";

export type ComposerSttPhase = "idle" | "listening" | "transcribing";

type SpeechRecCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const BARS = [4, 7, 11, 8, 5, 12, 9, 6, 10, 7];

/** Небольшая задержка перед финализацией: в части движков onend приходит чуть раньше последнего onresult. */
const END_FLUSH_MS = 90;

type Props = {
  disabled?: boolean;
  allowSound: boolean;
  onTranscript: (text: string) => void;
  /** «!» внутри капсулы; оверлей ренерит родитель по onUiChange */
  embedded?: boolean;
  onUiChange?: (state: { phase: ComposerSttPhase; liveLine: string }) => void;
  /** Пустой результат (тишина, ошибка, нет API) — без вставки демо-текста */
  onEmptyResult?: () => void;
};

export function ChatComposerSttPhaseOverlay({
  phase,
  liveLine,
}: {
  phase: ComposerSttPhase;
  liveLine: string;
}) {
  if (phase === "idle") return null;
  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-0 right-0 z-[130] flex justify-center px-2">
      <div className="pointer-events-auto w-full max-w-4xl">
        {phase === "listening" ? (
          <div
            className="mx-auto flex max-w-md flex-col items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-2.5 backdrop-blur-md dark:border-primary/35 dark:bg-primary/20"
            role="status"
            aria-live="polite"
            aria-atomic="false"
          >
            <span className="text-[11px] font-medium text-primary dark:text-indigo-200">Слушаю…</span>
            <div className="flex h-5 items-end justify-center gap-0.5">
              {BARS.slice(0, 8).map((h, i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-full bg-primary animate-pulse dark:bg-indigo-300"
                  style={{ height: h, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
            {liveLine.trim() ? (
              <p className="line-clamp-3 w-full text-center text-[12px] leading-snug text-foreground/90 dark:text-white/85">
                {liveLine}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className="mx-auto max-w-md rounded-2xl border border-violet-400/40 bg-violet-950/50 px-4 py-2.5 backdrop-blur-md dark:border-violet-400/45"
            role="status"
            aria-live="polite"
            aria-atomic="false"
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-300/90">Распознаю…</span>
            <p className="line-clamp-3 min-h-[2.5rem] text-[12px] leading-snug text-violet-50/95">{liveLine || "…"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Голос → текст через Web Speech API. Пустой результат не подменяется демо-текстом.
 */
export function ChatComposerSttButton({
  disabled,
  allowSound,
  onTranscript,
  embedded,
  onUiChange,
  onEmptyResult,
}: Props) {
  const [phase, setPhase] = useState<ComposerSttPhase>("idle");
  const [liveLine, setLiveLine] = useState("");
  const recRef = useRef<InstanceType<SpeechRecCtor> | null>(null);
  const transcriptRef = useRef("");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const listenFinishedRef = useRef(false);
  const listenStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onUiChange?.({ phase, liveLine });
  }, [phase, liveLine, onUiChange]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    if (listenStopTimerRef.current) {
      clearTimeout(listenStopTimerRef.current);
      listenStopTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
    }
    recRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopRecognition();
    };
  }, [clearTimers, stopRecognition]);

  const runRevealWords = useCallback(
    (words: string[], then: string) => {
      setPhase("transcribing");
      setLiveLine("");
      let i = 0;
      const step = () => {
        if (i >= words.length) {
          playPulseUiTone("stt_done", allowSound);
          onTranscript(then.trim());
          setPhase("idle");
          setLiveLine("");
          listenFinishedRef.current = false;
          return;
        }
        const delay = 160 + Math.floor(Math.random() * 100);
        const t = setTimeout(() => {
          setLiveLine((prev) => (prev ? `${prev} ${words[i]}` : words[i]));
          i += 1;
          step();
        }, delay);
        timersRef.current.push(t);
      };
      step();
    },
    [allowSound, onTranscript],
  );

  const finishListening = useCallback(
    (raw: string) => {
      if (listenFinishedRef.current) return;
      listenFinishedRef.current = true;
      stopRecognition();
      const trimmed = raw.trim();
      if (trimmed) {
        const words = trimmed.split(/\s+/).filter(Boolean);
        runRevealWords(words.length ? words : [trimmed], trimmed);
        return;
      }
      setPhase("idle");
      setLiveLine("");
      onEmptyResult?.();
    },
    [onEmptyResult, runRevealWords, stopRecognition],
  );

  const scheduleFinishFromEnd = useCallback(() => {
    const t = window.setTimeout(() => finishListening(transcriptRef.current), END_FLUSH_MS);
    timersRef.current.push(t);
  }, [finishListening]);

  const startListening = useCallback(() => {
    if (disabled || phase !== "idle") return;
    listenFinishedRef.current = false;
    playPulseUiTone("stt_start", allowSound);
    transcriptRef.current = "";
    setLiveLine("");
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setPhase("listening");
      timersRef.current.push(
        setTimeout(() => {
          finishListening("");
        }, 2400),
      );
      return;
    }

    try {
      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "ru-RU";
      rec.onresult = (ev) => {
        let line = "";
        for (let i = 0; i < ev.results.length; i++) {
          line += ev.results[i]?.[0]?.transcript ?? "";
        }
        const t = line.trim();
        transcriptRef.current = t;
        setLiveLine(t);
      };
      rec.onerror = () => {
        transcriptRef.current = transcriptRef.current || "";
      };
      rec.onend = () => {
        if (listenStopTimerRef.current) {
          clearTimeout(listenStopTimerRef.current);
          listenStopTimerRef.current = null;
        }
        scheduleFinishFromEnd();
      };
      recRef.current = rec;
      rec.start();
      setPhase("listening");
      listenStopTimerRef.current = setTimeout(() => {
        listenStopTimerRef.current = null;
        try {
          rec.stop();
        } catch {
          scheduleFinishFromEnd();
        }
      }, 2600);
    } catch {
      setPhase("listening");
      timersRef.current.push(setTimeout(() => finishListening(""), 2400));
    }
  }, [allowSound, disabled, finishListening, phase, scheduleFinishFromEnd]);

  if (!embedded && phase === "listening") {
    return (
      <div
        className="flex min-h-[var(--uix-touch-min)] min-w-[3rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/35 bg-primary/10 px-2 py-1"
        role="status"
        aria-live="polite"
      >
        <span className="text-[10px] font-medium text-primary">Слушаю…</span>
        <div className="flex h-4 items-end justify-center gap-0.5">
          {BARS.slice(0, 8).map((h, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full bg-primary/80 animate-pulse"
              style={{ height: h, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!embedded && phase === "transcribing") {
    return (
      <div
        className="flex max-w-[140px] min-h-[var(--uix-touch-min)] shrink-0 flex-col justify-center rounded-2xl border border-violet-400/35 bg-violet-500/10 px-2 py-1"
        role="status"
        aria-live="polite"
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600/90 dark:text-violet-300/90">
          Распознаю…
        </span>
        <p className="line-clamp-2 text-[11px] leading-tight text-foreground/90">{liveLine || "…"}</p>
      </div>
    );
  }

  const idleBtn = (
    <TapScaleButton
      type="button"
      haptic
      disabled={disabled}
      onClick={startListening}
      className={cn(
        embedded
          ? "mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] font-black leading-none text-primary transition-colors hover:bg-black/8 dark:hover:bg-white/10"
          : "chat-composer-round flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 items-center justify-center font-black text-primary",
      )}
      aria-label="Голос в текст"
      title="Голос в текст"
    >
      <span aria-hidden>!</span>
    </TapScaleButton>
  );

  if (embedded) {
    return phase === "idle" ? idleBtn : <span className="mr-0.5 inline-flex h-9 w-9 shrink-0" aria-hidden />;
  }

  return idleBtn;
}
