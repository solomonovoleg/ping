import { useState, useCallback, useRef } from "react";

export type VoiceRecorderState = "idle" | "recording" | "error";

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
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start(250);
      setState("recording");
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        setDurationSec((s) => s + 1);
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Нет доступа к микрофону";
      setError(msg);
      setState("error");
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        setState("idle");
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const stream = streamRef.current;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setState("idle");
        setDurationSec(0);
        const fallbackType =
          recorder.mimeType ||
          (mimeType && mimeType.startsWith("audio/") ? mimeType.split(";")[0] : "") ||
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
  }, []);

  const isSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  return { state, error, durationSec, start, stop, isSupported };
}
