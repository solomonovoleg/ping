import { useCallback, useEffect, useRef, useState } from "react";
import { primeMicrophoneCapture } from "@/lib/media-capture-prime";
import { PINGOK_STT_MAX_MS } from "./constants";

export type PingokMicroSttPhase = "idle" | "listening" | "error";

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

const END_FLUSH_MS = 90;

type UsePingokMicroSttOptions = {
  onFinal: (text: string) => void;
  maxMs?: number;
  /** Непрерывное распознавание до вызова submitStream() или abort. */
  stream?: boolean;
};

/**
 * Web Speech API для ПИНГОК МИКРО: одна реплика или стрим.
 */
export function usePingokMicroStt({ onFinal, maxMs = PINGOK_STT_MAX_MS, stream = false }: UsePingokMicroSttOptions) {
  const [phase, setPhase] = useState<PingokMicroSttPhase>("idle");
  const [liveLine, setLiveLine] = useState("");
  const recRef = useRef<InstanceType<SpeechRecCtor> | null>(null);
  const transcriptRef = useRef("");
  const accumulatedFinalRef = useRef("");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishedRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef(onFinal);
  const streamRef = useRef(stream);
  onFinalRef.current = onFinal;
  streamRef.current = stream;

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
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

  const finish = useCallback(
    (raw: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      stopRecognition();
      clearTimers();
      setPhase("idle");
      setLiveLine("");
      accumulatedFinalRef.current = "";
      onFinalRef.current(raw.trim());
    },
    [clearTimers, stopRecognition],
  );

  const scheduleFinishFromEnd = useCallback(() => {
    const t = setTimeout(() => finish(transcriptRef.current), END_FLUSH_MS);
    timersRef.current.push(t);
  }, [finish]);

  const submitStream = useCallback(() => {
    if (!streamRef.current || finishedRef.current) return;
    const merged = `${accumulatedFinalRef.current} ${transcriptRef.current}`.replace(/\s+/g, " ").trim();
    finish(merged);
  }, [finish]);

  const startRecognitionInstance = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return false;
    try {
      const rec = new Ctor();
      rec.continuous = streamRef.current;
      rec.interimResults = true;
      rec.lang = "ru-RU";
      rec.onresult = (ev) => {
        let display = "";
        for (let i = 0; i < ev.results.length; i++) {
          display += ev.results[i]?.[0]?.transcript ?? "";
        }
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r?.isFinal) {
            const seg = (r[0]?.transcript ?? "").trim();
            if (seg) accumulatedFinalRef.current = `${accumulatedFinalRef.current} ${seg}`.trim();
          }
        }
        const t = display.trim();
        transcriptRef.current = t;
        setLiveLine(t);
      };
      rec.onerror = () => {
        transcriptRef.current = transcriptRef.current || "";
      };
      rec.onend = () => {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        if (streamRef.current && !finishedRef.current) {
          const t = setTimeout(() => {
            if (finishedRef.current) return;
            try {
              rec.start();
            } catch {
              scheduleFinishFromEnd();
            }
          }, 80);
          timersRef.current.push(t);
          return;
        }
        scheduleFinishFromEnd();
      };
      recRef.current = rec;
      rec.start();
      if (!streamRef.current) {
        stopTimerRef.current = setTimeout(() => {
          stopTimerRef.current = null;
          try {
            rec.stop();
          } catch {
            scheduleFinishFromEnd();
          }
        }, maxMs);
      }
      return true;
    } catch {
      return false;
    }
  }, [maxMs, scheduleFinishFromEnd]);

  const start = useCallback(async () => {
    finishedRef.current = false;
    transcriptRef.current = "";
    accumulatedFinalRef.current = "";
    setLiveLine("");
    setPhase("listening");

    try {
      await primeMicrophoneCapture();
    } catch {
      /* noop */
    }

    if (!getSpeechRecognition()) {
      setPhase("error");
      timersRef.current.push(
        setTimeout(() => {
          finish("");
        }, 400),
      );
      return;
    }

    const ok = startRecognitionInstance();
    if (!ok) {
      setPhase("error");
      timersRef.current.push(setTimeout(() => finish(""), 400));
    }
  }, [finish, startRecognitionInstance]);

  const abort = useCallback(() => {
    finishedRef.current = true;
    clearTimers();
    stopRecognition();
    setPhase("idle");
    setLiveLine("");
    accumulatedFinalRef.current = "";
  }, [clearTimers, stopRecognition]);

  return { phase, liveLine, start, abort, submitStream };
}
