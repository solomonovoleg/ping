import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupCallMedia } from "@/lib/group-calls-api";
import { getMediaConstraints } from "@/features/call/call-ice-config";
import { mapMediaAccessError, isWebRtcSupported } from "@/features/call/webrtc-peer";
import { connectGroupCallWebSocket } from "../ws/group-call-ws-url";
import { GroupMeshRegistry, type RosterParticipant } from "./mesh-registry";
import { createStreamLevelReader, pickDominantSpeaker } from "../audio/speaker-levels";
import { useGroupCallTranscripts } from "../transcripts/useGroupCallTranscripts";
import { startGroupScreenShare } from "../utils/group-screen-share";

export type GroupCallUiPhase = "connecting" | "active" | "error" | "ended";

export function useGroupCallSession(params: {
  roomId: string;
  mediaType: GroupCallMedia;
  myUserId: string;
  myDisplayName: string;
  open: boolean;
  onEnded: () => void;
}): {
  phase: GroupCallUiPhase;
  error: string | null;
  localStream: MediaStream | null;
  participants: RosterParticipant[];
  centerUserId: string;
  activeSpeakerId: string | null;
  isVideo: boolean;
  isMuted: boolean;
  setMuted: (m: boolean) => void;
  /** Локальная камера выключена (трек остаётся, `enabled: false`) — как в макете PULSE. */
  isCameraOff: boolean;
  setCameraOff: (off: boolean) => void;
  getRemoteStream: (userId: string) => MediaStream | null;
  transcriptSegments: Array<{
    id: string;
    callId: string;
    speakerUserId: string;
    speakerDisplayName: string;
    textNormalized: string;
    isFinal: boolean;
    createdAt: string;
  }>;
  pendingSuggestions: Array<{
    id: string;
    callId: string;
    segmentId: string | null;
    title: string;
    intentType: string;
    payloadJson: string;
    status: "pending" | "accepted" | "dismissed";
    createdAt: string;
  }>;
  resolveSuggestion: (callId: string, suggestionId: string, status: "accepted" | "dismissed") => Promise<void>;
  hangup: () => void;
  captionsEnabled: boolean;
  toggleCaptions: () => void;
  canToggleTranscripts: boolean;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
  /** Сбрасывает привязку video к локальному превью при смене трека (камера ↔ экран). */
  localStreamRenderKey: number;
} {
  const { roomId, mediaType, myUserId, myDisplayName, open, onEnded } = params;
  const [phase, setPhase] = useState<GroupCallUiPhase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  /** Крупная плитка: только после ≥3 с непрерывного VAD у того же участника (резкие вставки не перехватывают экран). */
  const [stableFocusUserId, setStableFocusUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStreamsVersion, bumpRemote] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStreamRenderKey, setLocalStreamRenderKey] = useState(0);

  const meshRef = useRef(new GroupMeshRegistry());
  const screenShareStopRef = useRef<(() => Promise<void>) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const levelsRef = useRef<Map<string, () => number>>(new Map());
  const localLevelRef = useRef<() => number>(() => 0);
  const speakerHoldRef = useRef<{ userId: string; since: number } | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const endedOnceRef = useRef(false);

  const sendWs = useCallback((obj: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);
  const {
    segments: transcriptSegments,
    pendingSuggestions,
    stopLocalRecognition,
    onTranscriptSegment,
    onCommandSuggestion,
    resolveSuggestionLocal,
    captionsEnabled,
    toggleCaptions,
    canToggleTranscripts,
  } = useGroupCallTranscripts({
    roomId,
    myUserId,
    myDisplayName,
    sendWs,
    transcriptionActive: phase === "active",
    localMediaStream: localStream,
  });

  const notifyEndedOnce = useCallback(() => {
    if (endedOnceRef.current) return;
    endedOnceRef.current = true;
    onEndedRef.current();
  }, []);

  const hangup = useCallback(() => {
    void (async () => {
      const stopSs = screenShareStopRef.current;
      screenShareStopRef.current = null;
      if (stopSs) {
        try {
          await stopSs();
        } catch {
          /* ignore */
        }
        setIsScreenSharing(false);
        setLocalStreamRenderKey((k) => k + 1);
      }
      try {
        wsRef.current?.send(JSON.stringify({ type: "group.leave", roomId }));
      } catch {
        /* ignore */
      }
      wsRef.current?.close();
      wsRef.current = null;
      meshRef.current.fullDispose();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setIsCameraOff(false);
      levelsRef.current.clear();
      stopLocalRecognition();
      setPhase("ended");
      notifyEndedOnce();
    })();
  }, [roomId, notifyEndedOnce, stopLocalRecognition]);

  const toggleScreenShare = useCallback(async () => {
    if (mediaType !== "video" || phase !== "active") return;
    const mesh = meshRef.current;
    const stream = localStreamRef.current;
    if (!mesh || !stream) return;

    if (screenShareStopRef.current) {
      try {
        await screenShareStopRef.current();
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      const { stop } = await startGroupScreenShare(mesh, stream, {
        onStopped: () => {
          screenShareStopRef.current = null;
          setIsScreenSharing(false);
          setLocalStreamRenderKey((k) => k + 1);
          bumpRemote((n) => n + 1);
        },
      });
      screenShareStopRef.current = stop;
      setIsScreenSharing(true);
      setLocalStreamRenderKey((k) => k + 1);
      bumpRemote((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось включить демонстрацию экрана");
    }
  }, [mediaType, phase, bumpRemote]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    endedOnceRef.current = false;
    setActiveSpeakerId(null);
    setStableFocusUserId(null);
    speakerHoldRef.current = null;
    silenceStartRef.current = null;
    const mesh = new GroupMeshRegistry();
    meshRef.current = mesh;

    async function run() {
      if (!isWebRtcSupported()) {
        setError("Звонок недоступен в этом браузере");
        setPhase("error");
        return;
      }
      try {
        const video = mediaType === "video";
        const highQuality =
          typeof window !== "undefined" &&
          window.matchMedia("(min-width: 900px)").matches &&
          video;
        const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(video, { highQuality }));
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        localLevelRef.current = createStreamLevelReader(stream);

        const ws = await connectGroupCallWebSocket();
        if (cancelled) {
          ws.close();
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        wsRef.current = ws;

        mesh.init({
          myUserId,
          roomId,
          sendSignal: (toUserId, msg) => {
            sendWs(msg as Record<string, unknown>);
          },
        });

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
            const type = msg.type as string;
            if (type === "group.roster") {
              const list = (msg.participants as RosterParticipant[]) ?? [];
              setParticipants(list);
              const ls = localStreamRef.current;
              if (ls) mesh.onRoster(ls, list);
              levelsRef.current.clear();
              bumpRemote((n) => n + 1);
            } else if (type === "group.signal") {
              const from = msg.fromUserId as string;
              const st = msg.signalType as string;
              const ls = localStreamRef.current;
              if (!ls) return;
              void mesh
                .onSignal(
                  from,
                  st,
                  msg.sdp as RTCSessionDescriptionInit | undefined,
                  msg.candidate as RTCIceCandidateInit | undefined,
                  ls,
                )
                .then(() => {
                  levelsRef.current.clear();
                  bumpRemote((n) => n + 1);
                });
            } else if (type === "group.error") {
              setError((msg.message as string) || "Ошибка созвона");
              setPhase("error");
            } else if (type === "group.transcript-segment" && msg.segment) {
              onTranscriptSegment(msg.segment as {
                id: string;
                callId: string;
                speakerUserId: string;
                speakerDisplayName: string;
                textNormalized: string;
                isFinal: boolean;
                createdAt: string;
              });
            } else if (type === "group.command-suggestion" && msg.suggestion) {
              onCommandSuggestion(msg.suggestion as {
                id: string;
                callId: string;
                segmentId: string | null;
                title: string;
                intentType: string;
                payloadJson: string;
                status: "pending" | "accepted" | "dismissed";
                createdAt: string;
              });
            }
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          if (cancelled) return;
          setPhase("ended");
          notifyEndedOnce();
        };

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "group.join",
              roomId,
              displayName: myDisplayName,
            }),
          );
          setPhase("active");
        };
      } catch (e) {
        if (!cancelled) {
          setError(mapMediaAccessError(e));
          setPhase("error");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
      try {
        wsRef.current?.send(JSON.stringify({ type: "group.leave", roomId }));
      } catch {
        /* ignore */
      }
      wsRef.current?.close();
      wsRef.current = null;
      mesh.fullDispose();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      levelsRef.current.clear();
      stopLocalRecognition();
    };
  }, [open, roomId, mediaType, myUserId, myDisplayName, sendWs, notifyEndedOnce, onCommandSuggestion, onTranscriptSegment, stopLocalRecognition]);

  const STABLE_FOCUS_MS = 3000;
  const SILENCE_CLEAR_MS = 5000;

  useEffect(() => {
    if (phase !== "active" || !localStream) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      const m = new Map<string, () => number>();
      for (const p of participants) {
        if (p.userId === myUserId) continue;
        const rs = meshRef.current.getRemoteStream(p.userId);
        if (rs?.getAudioTracks().length) {
          let reader = levelsRef.current.get(p.userId);
          if (!reader) {
            reader = createStreamLevelReader(rs);
            levelsRef.current.set(p.userId, reader);
          }
          m.set(p.userId, reader);
        }
      }
      const dom = pickDominantSpeaker(m, myUserId, localLevelRef.current);
      setActiveSpeakerId((prev) => (prev === dom ? prev : dom));

      if (dom) {
        silenceStartRef.current = null;
        const h = speakerHoldRef.current;
        if (!h || h.userId !== dom) {
          speakerHoldRef.current = { userId: dom, since: now };
        } else if (now - h.since >= STABLE_FOCUS_MS) {
          setStableFocusUserId((prev) => (prev === dom ? prev : dom));
        }
      } else {
        speakerHoldRef.current = null;
        if (silenceStartRef.current == null) silenceStartRef.current = now;
        else if (now - silenceStartRef.current >= SILENCE_CLEAR_MS) {
          setStableFocusUserId(null);
          silenceStartRef.current = null;
        }
      }
    }, 180);
    return () => clearInterval(t);
  }, [phase, localStream, participants, myUserId]);

  const setMuted = useCallback((m: boolean) => {
    setIsMuted(m);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !m;
    });
  }, []);

  const setCameraOff = useCallback((off: boolean) => {
    setIsCameraOff(off);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !off;
    });
  }, []);

  const getRemoteStream = useCallback((userId: string) => meshRef.current.getRemoteStream(userId), []);

  const others = participants.filter((p) => p.userId !== myUserId);
  const fallbackCenter = others[0]?.userId ?? myUserId;
  const centerId = stableFocusUserId ?? fallbackCenter;

  return {
    phase,
    error,
    localStream,
    participants,
    centerUserId: centerId,
    activeSpeakerId,
    isVideo: mediaType === "video",
    isMuted,
    setMuted,
    isCameraOff,
    setCameraOff,
    getRemoteStream,
    transcriptSegments,
    pendingSuggestions,
    resolveSuggestion: resolveSuggestionLocal,
    hangup,
    captionsEnabled,
    toggleCaptions,
    canToggleTranscripts,
    isScreenSharing,
    toggleScreenShare,
    localStreamRenderKey,
  };
}
