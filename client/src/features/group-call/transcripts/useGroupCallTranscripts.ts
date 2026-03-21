import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveCaptionsController } from "@/features/call/utils/live-captions";
import { getCallFeatureFlags } from "@/features/call/call-feature-flags";
import { getCallFeatureSupport } from "@/features/call/call-capabilities";
import { resolveCallSuggestion } from "@/lib/call-history";
import {
  isGroupCallAsrPcmStreamPreferred,
  isGroupCallModuleEnabled,
  isGroupCallServerAsrEnabled,
} from "../flags";
import type { GroupCommandSuggestion, GroupTranscriptSegment } from "./types";
import { GroupCallPcmStreamer } from "./pcm-streamer";

function upsertById<T extends { id: string }>(list: T[], next: T, limit = 40): T[] {
  const idx = list.findIndex((item) => item.id === next.id);
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = next;
    return copy;
  }
  return [...list, next].slice(-limit);
}

export function useGroupCallTranscripts(params: {
  roomId: string;
  myUserId: string;
  myDisplayName: string;
  sendWs: (data: Record<string, unknown>) => void;
  /** Созвон в фазе active — иначе не поднимаем захват речи. */
  transcriptionActive: boolean;
  localMediaStream: MediaStream | null;
}) {
  const { roomId, myUserId, myDisplayName, sendWs, transcriptionActive, localMediaStream } = params;
  const [segments, setSegments] = useState<GroupTranscriptSegment[]>([]);
  const [suggestions, setSuggestions] = useState<GroupCommandSuggestion[]>([]);
  const captionSupport = useMemo(() => getCallFeatureSupport(getCallFeatureFlags()), []);
  const hasWebSpeech = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
    );
  }, []);
  /** Хук только для группового звонка — кнопку не блокируем env 1:1; захват см. shouldCapture и allowLocalStt. */
  const canToggleTranscripts = true;

  /** По умолчанию выкл.: иначе браузерный STT ловит посторонний шум и кажется «чужие титры». Включается кнопкой субтитров. */
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const controllerRef = useRef<LiveCaptionsController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pcmRef = useRef<GroupCallPcmStreamer | null>(null);

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((v) => !v);
  }, []);

  const startLocalRecognition = useCallback((opts?: { relayToRoom?: boolean }) => {
    if (controllerRef.current) return;
    const relayToRoom = opts?.relayToRoom !== false;
    controllerRef.current = new LiveCaptionsController(
      (text) => {
        const id = crypto.randomUUID();
        if (relayToRoom) {
          sendWs({
            type: "group.transcript-segment",
            roomId,
            segmentId: id,
            text,
            confidence: 78,
            startedAtMs: Date.now(),
            endedAtMs: Date.now(),
            isFinal: true,
            language: "ru-RU",
          });
        }
        setSegments((prev) =>
          upsertById(prev, {
            id,
            callId: roomId,
            speakerUserId: myUserId,
            speakerDisplayName: myDisplayName,
            textNormalized: text,
            isFinal: true,
            createdAt: new Date().toISOString(),
          }),
        );
      },
      () => {},
    );
    controllerRef.current.start();
  }, [myDisplayName, myUserId, roomId, sendWs]);

  const stopLocalRecognition = useCallback(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    pcmRef.current?.stop();
    pcmRef.current = null;
  }, []);

  useEffect(() => {
    setSegments([]);
    setSuggestions([]);
    setCaptionsEnabled(false);
    stopLocalRecognition();
  }, [roomId, stopLocalRecognition]);

  const startServerAsr = useCallback((stream: MediaStream) => {
    if (!isGroupCallServerAsrEnabled()) return false;
    if (!pcmRef.current) {
      pcmRef.current = new GroupCallPcmStreamer((audioBase64, startedAtMs, endedAtMs) => {
        sendWs({
          type: "group.asr-pcm",
          roomId,
          audioBase64,
          language: "ru-RU",
          startedAtMs,
          endedAtMs,
        });
      });
    }

    const preferPcmStream = isGroupCallAsrPcmStreamPreferred();
    if (preferPcmStream && pcmRef.current.start(stream)) return true;

    if (typeof MediaRecorder === "function" && !recorderRef.current) {
      const audioTracks = stream.getAudioTracks().filter((track) => track.readyState === "live");
      if (audioTracks.length > 0) {
        const audioOnly = new MediaStream(audioTracks);
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const recorder = new MediaRecorder(audioOnly, { mimeType });
        let chunkStartedAt = Date.now();
        recorder.ondataavailable = async (event) => {
          if (!event.data || event.data.size === 0) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            const base64 = result.includes(",") ? result.split(",")[1] ?? "" : "";
            if (!base64) return;
            const endedAt = Date.now();
            sendWs({
              type: "group.asr-audio",
              roomId,
              segmentId: crypto.randomUUID(),
              mimeType,
              language: "ru-RU",
              audioBase64: base64,
              startedAtMs: chunkStartedAt,
              endedAtMs: endedAt,
            });
            chunkStartedAt = endedAt;
          };
          reader.readAsDataURL(event.data);
        };
        recorder.start(2500);
        recorderRef.current = recorder;
        return true;
      }
    }

    if (!preferPcmStream && pcmRef.current.start(stream)) return true;
    return false;
  }, [roomId, sendWs]);

  const shouldCapture = captionsEnabled && transcriptionActive;

  useEffect(() => {
    if (!shouldCapture || !localMediaStream) {
      return;
    }
    const usedServerAsr = startServerAsr(localMediaStream);
    const allowLocalStt =
      captionSupport.captionsLocalSTT ||
      (isGroupCallModuleEnabled() && hasWebSpeech);
    /** Серверный ASR без Vosk даёт тишину — тогда хотя бы свои слова в оверлее (без второго group.transcript-segment). */
    if (allowLocalStt) {
      startLocalRecognition({ relayToRoom: !usedServerAsr });
    }
    return () => {
      stopLocalRecognition();
    };
  }, [
    shouldCapture,
    localMediaStream,
    startServerAsr,
    startLocalRecognition,
    stopLocalRecognition,
    captionSupport.captionsLocalSTT,
    hasWebSpeech,
  ]);

  const onTranscriptSegment = useCallback((segment: GroupTranscriptSegment) => {
    setSegments((prev) => upsertById(prev, segment));
  }, []);

  const onCommandSuggestion = useCallback((suggestion: GroupCommandSuggestion) => {
    setSuggestions((prev) => upsertById(prev, suggestion, 12));
  }, []);

  const resolveSuggestionLocal = useCallback(async (callId: string, suggestionId: string, status: "accepted" | "dismissed") => {
    await resolveCallSuggestion(callId, suggestionId, status);
    setSuggestions((prev) => prev.map((item) => (item.id === suggestionId ? { ...item, status } : item)));
  }, []);

  const pendingSuggestions = useMemo(() => suggestions.filter((item) => item.status === "pending"), [suggestions]);

  return {
    segments,
    pendingSuggestions,
    stopLocalRecognition,
    onTranscriptSegment,
    onCommandSuggestion,
    resolveSuggestionLocal,
    captionsEnabled,
    toggleCaptions,
    canToggleTranscripts,
  };
}
