import { useState, useCallback, useRef } from "react";

export type VoiceRecorderState = "idle" | "recording" | "error";

function mapVoiceMediaError(err: unknown): string {
  if (err instanceof Error) {
    const { name, message } = err;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Разрешите доступ к микрофону в настройках браузера или приложения";
    }
    if (message?.toLowerCase().includes("not allowed") || message?.toLowerCase().includes("denied permission")) {
      return "Разрешите доступ к микрофону в настройках браузера или приложения";
    }
    if (name === "NotFoundError") return "Микрофон не найден";
    if (name === "NotReadableError") return "Микрофон занят. Закройте другие приложения.";
  }
  return "Нет доступа к микрофону";
}
export const MAX_VOICE_DURATION_SEC = 80;

/**
 * Запись голоса через MediaRecorder API (без внешних библиотек).
 * Поддерживается в современных браузерах и мобильных.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const selectedMimeTypeRef = useRef<string>("");

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedAtRef.current = null;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")
        ? "audio/mp4;codecs=mp4a.40.2"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : "";
      selectedMimeTypeRef.current = mimeType;
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
      };

      recorder.start(250);
      setState("recording");
      setDurationSec(0);
      startedAtRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (!startedAtRef.current) return;
        // Не считаем длительность по чанкам/timeslice: интервалы там нестрогие.
        const elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDurationSec(elapsedSec);
      }, 250);
    } catch (e) {
      const msg = mapVoiceMediaError(e);
      setError(msg);
      setState("error");
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        cleanup();
        setState("idle");
        setDurationSec(0);
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        cleanup();
        setState("idle");
        setDurationSec(0);
        const fallbackType =
          recorder.mimeType ||
          (selectedMimeTypeRef.current && selectedMimeTypeRef.current.startsWith("audio/")
            ? selectedMimeTypeRef.current.split(";")[0]
            : "") ||
          "audio/mp4";
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: fallbackType })
            : null;
        chunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, [cleanup]);

  const isSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  return { state, error, durationSec, start, stop, isSupported };
}
