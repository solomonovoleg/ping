import { useState, useRef, useCallback, useEffect } from "react";
import { getCallToken, getCallWsUrl, getIceServers, getMediaConstraints, transformPeerSdp, CallTokenUnauthorizedError, type CallSignalingMessage } from "@/lib/calls";
import { RING_TIMEOUT_MS, CONNECTING_OFFER_TIMEOUT_MS } from "@/lib/call-constants";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import SimplePeer from "simple-peer";
import { startIncomingCallAlert, startRingbackTone } from "@/lib/incoming-call-alert";

export type CallState =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "in-call"
  | "failed"
  | "ended";

export type CallDirection = "outgoing" | "incoming";

type IncomingInfo = {
  fromUserId: string;
  fromDisplayName: string | null;
  chatId: string;
  video: boolean;
};

export function useCall(myUserId: string | undefined) {
  const { user, refetch: refetchAuth } = useAuth();
  const [state, setState] = useState<CallState>("idle");
  const [direction, setDirection] = useState<CallDirection>("outgoing");
  const [isVideo, setIsVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [incoming, setIncoming] = useState<IncomingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);

  const peerRef = useRef<InstanceType<typeof SimplePeer> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const otherUserIdRef = useRef<string | null>(null);
  const otherNameRef = useRef<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  /** ICE от звонящего, пришедшие до принятия звонка — применяем после peer.signal(offer) */
  const pendingIceRef = useRef<Array<{ candidate?: string; sdpMLineIndex?: number; sdpMid?: string }>>([]);
  /** Приняли звонок до прихода offer — ждём offer в onmessage и тогда создаём peer и шлём call-accept */
  const acceptingWaitingOfferRef = useRef(false);
  const acceptingVideoRef = useRef(false);
  const connectingOfferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopIncomingAlertRef = useRef<(() => void) | null>(null);
  const stopRingbackRef = useRef<(() => void) | null>(null);
  const chatListenersRef = useRef<Map<string, Set<(msg: { id: string; chatId: string; senderId: string | null; type: string; content: string; createdAt: string }) => void>>>(new Map());
  const typingListenersRef = useRef<Map<string, Set<(userId: string, displayName: string | null) => void>>>(new Map());
  const voiceRecordingListenersRef = useRef<Map<string, Set<(userId: string, displayName: string | null, recording: boolean) => void>>>(new Map());
  /** Вызывается при onclose сокета — переподключение для real-time чатов/списка */
  const scheduleReconnectRef = useRef<(() => void) | null>(null);

  const isWebRtcSupported = useCallback((): boolean => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const hasRTCPeerConnection =
      typeof window.RTCPeerConnection === "function" ||
      typeof (window as unknown as { webkitRTCPeerConnection?: unknown }).webkitRTCPeerConnection === "function";
    const hasGetUserMedia = typeof navigator.mediaDevices?.getUserMedia === "function";
    return hasRTCPeerConnection && hasGetUserMedia;
  }, []);

  const mapMediaAccessError = useCallback((err: unknown): string => {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Разрешите доступ к микрофону (и камере для видео) в настройках браузера";
    }
    if (name === "NotFoundError") {
      return "Микрофон или камера не найдены";
    }
    if (name === "NotReadableError") {
      return "Устройство занято другим приложением. Закройте другие звонки/диктофон и попробуйте снова.";
    }
    if (name === "OverconstrainedError") {
      return "Параметры камеры/микрофона не поддерживаются на этом устройстве.";
    }
    return "Нет доступа к микрофону или камере";
  }, []);

  const getUserMediaWithFallback = useCallback(async (video: boolean): Promise<MediaStream> => {
    if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      const err = new Error("Звонки не поддерживаются в этом браузере. Откройте сайт в Safari/Chrome по HTTPS.");
      err.name = "NotSupportedError";
      throw err;
    }

    const attempts: MediaStreamConstraints[] = [
      getMediaConstraints(video),
      // iOS Safari/WebView fallback: минимизируем constraints, которые часто ломают getUserMedia
      { audio: true, video: video ? { facingMode: "user" } : false },
      { audio: true, video: !!video },
    ];

    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastErr = err;
        console.warn("[call] getUserMedia attempt failed", err);
      }
    }

    const message = mapMediaAccessError(lastErr);
    const out = new Error(message);
    if (lastErr instanceof Error) out.name = lastErr.name;
    throw out;
  }, [mapMediaAccessError]);

  const cleanup = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState(null);
    otherUserIdRef.current = null;
    otherNameRef.current = null;
    chatIdRef.current = null;
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    acceptingWaitingOfferRef.current = false;
    if (connectingOfferTimeoutRef.current) {
      clearTimeout(connectingOfferTimeoutRef.current);
      connectingOfferTimeoutRef.current = null;
    }
  }, []);

  /** Только peer и потоки, без сброса refs звонка (для состояния failed и повторного вызова). */
  const cleanupPeerOnly = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState(null);
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    if (connectingOfferTimeoutRef.current) {
      clearTimeout(connectingOfferTimeoutRef.current);
      connectingOfferTimeoutRef.current = null;
    }
  }, []);

  const attachConnectionState = useCallback((peer: InstanceType<typeof SimplePeer>) => {
    const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
    if (!pc) return;
    const onState = () => setConnectionState(pc.connectionState);
    pc.addEventListener("connectionstatechange", onState);
    onState();
  }, []);

  const closeWs = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const stopRinging = useCallback(() => {
    stopIncomingAlertRef.current?.();
    stopIncomingAlertRef.current = null;
    stopRingbackRef.current?.();
    stopRingbackRef.current = null;
  }, []);

  const endCall = useCallback((opts?: { connectionLost?: boolean; notifyPeer?: boolean }) => {
    stopRinging();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    const shouldNotifyPeer = opts?.notifyPeer ?? true;
    const target = otherUserIdRef.current;
    const hadActiveCall = !!target;
    const ws = wsRef.current;
    if (shouldNotifyPeer && ws && ws.readyState === 1 && target) {
      try {
        ws.send(JSON.stringify({ type: "call-end", targetUserId: target }));
      } catch (e) {
        console.error("[call] send call-end failed", e);
      }
    }
    cleanup();
    setState("idle");
    setIncoming(null);
    if (opts?.connectionLost && hadActiveCall) {
      toast({ title: "Соединение прервано", variant: "destructive" });
    }
    setError(null);
  }, [cleanup, stopRinging]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const target = otherUserIdRef.current;
    if (!target) return;
    const ws = wsRef.current;
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ ...msg, targetUserId: target }));
    }
  }, []);

  /** Отправка signal от simple-peer по WebSocket в формате, ожидаемом сервером */
  const sendSignal = useCallback(
    (data: { type?: string; sdp?: string; candidate?: string; sdpMLineIndex?: number; sdpMid?: string }) => {
      if (data.type === "offer" || data.type === "answer") {
        send({ type: data.type, sdp: { type: data.type, sdp: data.sdp } });
      } else if (data.candidate != null) {
        send({ type: "ice-candidate", candidate: { candidate: data.candidate, sdpMLineIndex: data.sdpMLineIndex, sdpMid: data.sdpMid } });
      }
    },
    [send]
  );

  const sendSubscribeChat = useCallback((ws: WebSocket, chatId: string) => {
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: "subscribe-chat", chatId }));
      } catch (e) {
        console.error("[call] send subscribe-chat failed", chatId, e);
      }
    }
  }, []);

  const sendUnsubscribeChat = useCallback((chatId: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: "unsubscribe-chat", chatId }));
      } catch (e) {
        console.error("[call] send unsubscribe-chat failed", chatId, e);
      }
    }
  }, []);

  const subscribeChat = useCallback((chatId: string, onMessage: (msg: { id: string; chatId: string; senderId: string | null; type: string; content: string; createdAt: string }) => void) => {
    let set = chatListenersRef.current.get(chatId);
    if (!set) {
      set = new Set();
      chatListenersRef.current.set(chatId, set);
    }
    const isNewSubscription = set.size === 0;
    set.add(onMessage);
    if (isNewSubscription) {
      const ws = wsRef.current;
      if (ws) sendSubscribeChat(ws, chatId);
    }
    return () => {
      set!.delete(onMessage);
      if (set!.size === 0) {
        chatListenersRef.current.delete(chatId);
        sendUnsubscribeChat(chatId);
      }
    };
  }, [sendSubscribeChat, sendUnsubscribeChat]);

  const sendTyping = useCallback((chatId: string, displayName?: string | null) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: "typing", chatId, displayName: displayName ?? null }));
      } catch (e) {
        console.error("[call] send typing failed", chatId, e);
      }
    }
  }, []);

  const subscribeTyping = useCallback((chatId: string, onTyping: (userId: string, displayName: string | null) => void) => {
    let set = typingListenersRef.current.get(chatId);
    if (!set) {
      set = new Set();
      typingListenersRef.current.set(chatId, set);
    }
    set.add(onTyping);
    return () => {
      set!.delete(onTyping);
      if (set!.size === 0) typingListenersRef.current.delete(chatId);
    };
  }, []);

  const sendVoiceRecording = useCallback((chatId: string, displayName: string | null, recording: boolean) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: "voice-recording", chatId, displayName, recording }));
      } catch (e) {
        console.error("[call] send voice-recording failed", chatId, e);
      }
    }
  }, []);

  const subscribeVoiceRecording = useCallback((chatId: string, onRecording: (userId: string, displayName: string | null, recording: boolean) => void) => {
    let set = voiceRecordingListenersRef.current.get(chatId);
    if (!set) {
      set = new Set();
      voiceRecordingListenersRef.current.set(chatId, set);
    }
    set.add(onRecording);
    return () => {
      set!.delete(onRecording);
      if (set!.size === 0) voiceRecordingListenersRef.current.delete(chatId);
    };
  }, []);

  const attachWsHandlers = useCallback((ws: WebSocket) => {
    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string) as Record<string, unknown> & { type?: string; chatId?: string; message?: { id: string; chatId: string; senderId: string | null; type: string; content: string; createdAt: string }; fromUserId?: string; fromDisplayName?: string };
        if (raw.type === "chat-message" && raw.chatId && raw.message) {
          const set = chatListenersRef.current.get(raw.chatId);
          if (set) set.forEach((cb) => cb(raw.message!));
          return;
        }
        if (raw.type === "chat-list-update") {
          window.dispatchEvent(new CustomEvent("ping:chat-list-update"));
          return;
        }
        if (raw.type === "chat-read" && raw.chatId && raw.lastReadAt) {
          window.dispatchEvent(new CustomEvent("ping:chat-read", { detail: { chatId: raw.chatId, readerId: raw.readerId, lastReadAt: raw.lastReadAt } }));
          window.dispatchEvent(new CustomEvent("ping:chat-list-update"));
          return;
        }
        if (raw.type === "typing" && raw.chatId && typeof raw.userId === "string") {
          const set = typingListenersRef.current.get(raw.chatId as string);
          if (set) set.forEach((cb) => cb(raw.userId as string, (raw.displayName as string) ?? null));
          return;
        }
        if (raw.type === "voice-recording" && raw.chatId && typeof raw.userId === "string") {
          const set = voiceRecordingListenersRef.current.get(raw.chatId as string);
          if (set) set.forEach((cb) => cb(raw.userId as string, (raw.displayName as string) ?? null, raw.recording === true));
          return;
        }
        const msg = raw as CallSignalingMessage & { fromUserId?: string; fromDisplayName?: string; chatId?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
        if (msg.type === "call-initiate") {
          stopIncomingAlertRef.current?.();
          stopIncomingAlertRef.current = startIncomingCallAlert(msg.fromDisplayName ?? null);
          setIncoming({
            fromUserId: msg.fromUserId ?? "",
            fromDisplayName: msg.fromDisplayName ?? null,
            chatId: msg.chatId ?? "",
            video: msg.video ?? false,
          });
          setState("ringing");
        } else if (msg.type === "offer") {
          const sdp = msg.sdp ?? null;
          pendingOfferRef.current = sdp;
          if (acceptingWaitingOfferRef.current && sdp && typeof sdp === "object" && "sdp" in sdp) {
            acceptingWaitingOfferRef.current = false;
            if (connectingOfferTimeoutRef.current) {
              clearTimeout(connectingOfferTimeoutRef.current);
              connectingOfferTimeoutRef.current = null;
            }
            const stream = localStreamRef.current;
            const targetId = otherUserIdRef.current;
            const video = acceptingVideoRef.current;
            if (stream && targetId && wsRef.current?.readyState === 1) {
              try {
                const peer = new SimplePeer({
                  initiator: false,
                  stream,
                  trickle: true,
                  config: { iceServers: getIceServers() },
                  sdpTransform: transformPeerSdp,
                });
                peerRef.current = peer;
                attachConnectionState(peer);
                peer.on("signal", (data) => sendSignal(data as { type?: string; sdp?: string; candidate?: string; sdpMLineIndex?: number; sdpMid?: string }));
                peer.on("connect", () => setState("in-call"));
                peer.on("stream", (stream) => setRemoteStream(stream));
                peer.on("error", (err) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  console.error("[call] peer error:", err);
                  cleanupPeerOnly();
                  setError(msg.includes("ICE") || msg.includes("connection") ? "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова." : "Ошибка соединения");
                  setState("failed");
                });
                peer.on("close", () => endCall());
                wsRef.current.send(JSON.stringify({ type: "call-accept", targetUserId: targetId, video }));
                const offerSdp = (sdp && typeof sdp === "object" && "sdp" in sdp ? sdp.sdp : "") ?? "";
                if (!offerSdp) {
                  console.error("[call] empty offer SDP");
                  setError("Ошибка соединения");
                  setState("idle");
                  cleanup();
                  return;
                }
                try {
                  peer.signal({ type: "offer", sdp: offerSdp });
                  pendingIceRef.current.forEach((c) => peer.signal({ type: "candidate", ...c }));
                  pendingIceRef.current = [];
                } catch (e) {
                  console.error("[call] peer.signal(offer) error:", e);
                  setError("Ошибка соединения");
                  setState("idle");
                  cleanup();
                  return;
                }
              } catch (e) {
                console.error("[call] accept on offer:", e);
                setError("Ошибка соединения");
                setState("idle");
                cleanup();
              }
            } else {
              // Поток ещё не готов (offer пришёл раньше getUserMedia) — не сбрасываем, offer в pendingOfferRef; peer создадим в acceptCall когда stream придёт
              return;
            }
          }
        } else if (msg.type === "call-accept") {
          stopRingbackRef.current?.();
          stopRingbackRef.current = null;
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          // Остаёмся в "calling" до установки peer (connect) — in-call выставится в runOutgoingCall по peer.on("connect")
        } else if (msg.type === "call-reject") {
          stopIncomingAlertRef.current?.();
          stopIncomingAlertRef.current = null;
          acceptingWaitingOfferRef.current = false;
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          setState("idle");
          cleanup();
        } else if (msg.type === "target-offline") {
          stopRingbackRef.current?.();
          stopRingbackRef.current = null;
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          setError("Абонент не в сети. Ему отправлено уведомление о звонке.");
          setState("idle");
          cleanup();
        } else if (msg.type === "target-waiting") {
          const waitMs = typeof msg.waitMs === "number" && msg.waitMs > 0 ? msg.waitMs : 30000;
          const waitSec = Math.max(1, Math.round(waitMs / 1000));
          setError(`Абонент не в сети. Пробуем дозвон ${waitSec} сек...`);
        } else if (msg.type === "call-end") {
          stopRingbackRef.current?.();
          stopRingbackRef.current = null;
          acceptingWaitingOfferRef.current = false;
          endCall({ notifyPeer: false });
        } else if (msg.type === "answer") {
          stopRingbackRef.current?.();
          stopRingbackRef.current = null;
          if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          const peer = peerRef.current;
          const answerSdp = typeof msg.sdp === "object" && msg.sdp && "sdp" in msg.sdp ? msg.sdp.sdp : msg.sdp != null ? String(msg.sdp) : "";
          if (peer && answerSdp) {
            try {
              peer.signal({ type: "answer", sdp: answerSdp });
            } catch (e) {
              console.error("[call] peer.signal(answer) error:", e);
              setError("Ошибка при установке соединения. Попробуйте позвонить снова.");
              endCall();
              return;
            }
          }
          // in-call выставится по peer.on("connect") в runOutgoingCall
        } else if (msg.type === "ice-candidate") {
          const peer = peerRef.current;
          const c = (msg as { candidate?: RTCIceCandidateInit }).candidate;
          if (!c) return;
          const candidatePayload = { type: "candidate" as const, candidate: c.candidate, sdpMLineIndex: c.sdpMLineIndex ?? undefined, sdpMid: c.sdpMid ?? undefined };
          if (peer) {
            peer.signal(candidatePayload);
          } else {
            pendingIceRef.current.push(candidatePayload);
          }
        }
      } catch (e) {
        console.error("[call] ws message parse/handle error", e);
      }
    };
    ws.onclose = () => {
      wsRef.current = null;
      endCall({ connectionLost: true, notifyPeer: false });
      scheduleReconnectRef.current?.();
    };
    const sendAllChatSubscriptions = () => {
      Array.from(chatListenersRef.current.keys()).forEach((id) => sendSubscribeChat(ws, id));
    };
    ws.onopen = () => sendAllChatSubscriptions();
  }, [cleanup, endCall, sendSubscribeChat, sendSignal, cleanupPeerOnly, attachConnectionState]);

  const attachWsHandlersRef = useRef(attachWsHandlers);
  attachWsHandlersRef.current = attachWsHandlers;

  const runOutgoingCall = useCallback(
    async (
      ws: WebSocket,
      otherUserId: string,
      _otherName: string | null,
      chatId: string,
      video: boolean
    ) => {
      if (!isWebRtcSupported()) {
        const err = new Error("Звонки не поддерживаются в этом браузере. Откройте сайт в Safari/Chrome по HTTPS.");
        err.name = "NotSupportedError";
        throw err;
      }
      let stream: MediaStream;
      try {
        stream = await getUserMediaWithFallback(video);
      } catch (err) {
        throw err instanceof Error ? err : new Error(mapMediaAccessError(err));
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Сначала шлём call-initiate, чтобы абонент увидел «Входящий звонок» до прихода offer (убираем гонку порядка сообщений).
      const callerDisplayName =
        [user?.displayName, user?.surname].filter(Boolean).join(" ").trim() ||
        user?.phone ||
        "Абонент";
      ws.send(
        JSON.stringify({
          type: "call-initiate",
          targetUserId: otherUserId,
          video,
          chatId,
          fromDisplayName: callerDisplayName,
        })
      );

      const peer = new SimplePeer({
        initiator: true,
        stream,
        trickle: true,
        config: { iceServers: getIceServers() },
        sdpTransform: transformPeerSdp,
      });
      peerRef.current = peer;
      attachConnectionState(peer);

      peer.on("signal", (data) => sendSignal(data as { type?: string; sdp?: string; candidate?: string; sdpMLineIndex?: number; sdpMid?: string }));
      peer.on("connect", () => setState("in-call"));
      peer.on("stream", (stream) => setRemoteStream(stream));
      peer.on("error", (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[call] peer error:", err);
        cleanupPeerOnly();
        setError(msg.includes("ICE") || msg.includes("connection") ? "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова." : "Ошибка соединения");
        setState("failed");
      });
      peer.on("close", () => endCall());
    },
    [sendSignal, endCall, cleanup, cleanupPeerOnly, attachConnectionState, user?.displayName, user?.surname, user?.phone, isWebRtcSupported, getUserMediaWithFallback, mapMediaAccessError]
  );

  const WS_OPEN_TIMEOUT_MS = 12000;
  const BACKGROUND_CONNECT_MAX_RETRIES = 5;

  const ensureOpenWs = useCallback(async (): Promise<WebSocket> => {
    const existing = wsRef.current;
    if (existing?.readyState === 1) return existing;

    const openWsWithNewToken = async (): Promise<WebSocket> => {
      const token = await getCallToken();
      const socket = new WebSocket(getCallWsUrl(token));
      wsRef.current = socket;
      attachWsHandlers(socket);
      await new Promise<void>((resolve, reject) => {
        if (socket.readyState === 1) {
          resolve();
          return;
        }
        let settled = false;
        const done = (err: Error | null) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve();
        };
        const t = setTimeout(() => done(new Error("Не удалось подключиться к серверу звонков. Проверьте интернет.")), WS_OPEN_TIMEOUT_MS);
        const prevOnOpen = socket.onopen;
        const prevOnError = socket.onerror;
        const prevOnClose = socket.onclose;
        const safeCall = (fn: unknown, ctx: WebSocket, arg?: Event) => {
          try {
            if (fn != null && typeof fn === "function") (fn as (ev?: Event) => void).call(ctx, arg);
          } catch (e) {
            console.warn("[call] ws handler error", e);
          }
        };
        socket.onopen = (ev: Event) => {
          clearTimeout(t);
          safeCall(prevOnOpen, socket, ev);
          done(null);
        };
        socket.onerror = () => {
          clearTimeout(t);
          safeCall(prevOnError, socket);
          done(new Error("Ошибка соединения"));
        };
        socket.onclose = () => {
          clearTimeout(t);
          safeCall(prevOnClose, socket);
          done(new Error("Соединение закрыто"));
        };
      });
      return socket;
    };

    try {
      return await openWsWithNewToken();
    } catch (firstErr) {
      // При быстром обрыве (часто 401 на upgrade) — одна повторная попытка с новым токеном.
      const isQuickClose =
        firstErr instanceof Error &&
        (firstErr.message === "Соединение закрыто" || firstErr.message === "Ошибка соединения");
      if (!isQuickClose) throw firstErr;
      wsRef.current?.close();
      wsRef.current = null;
      return openWsWithNewToken();
    }
  }, [attachWsHandlers]);

  const startCall = useCallback(
    async (otherUserId: string, otherName: string | null, chatId: string, video: boolean) => {
      if (!myUserId) {
        toast({ title: "Невозможно позвонить: не авторизованы", variant: "destructive" });
        return;
      }
      setError(null);
      setDirection("outgoing");
      setIsVideo(video);
      otherUserIdRef.current = otherUserId;
      otherNameRef.current = otherName;
      chatIdRef.current = chatId;
      setState("calling");

      try {
        const socket = await ensureOpenWs();
        if (!socket || socket.readyState !== 1) {
          const errMsg = "Нет соединения с сервером звонков";
          setError(errMsg);
          setState("idle");
          toast({ title: errMsg, variant: "destructive" });
          return;
        }
        await runOutgoingCall(socket, otherUserId, otherName, chatId, video);
        stopRingbackRef.current?.();
        stopRingbackRef.current = startRingbackTone();
        ringTimeoutRef.current = setTimeout(() => {
          ringTimeoutRef.current = null;
          stopRingbackRef.current?.();
          stopRingbackRef.current = null;
          setError("Абонент не отвечает");
          setState("idle");
          cleanup();
        }, RING_TIMEOUT_MS);
      } catch (e) {
        const target = otherUserIdRef.current;
        const ws = wsRef.current;
        if (target && ws?.readyState === 1) {
          try {
            ws.send(JSON.stringify({ type: "call-end", targetUserId: target }));
          } catch (sendErr) {
            console.warn("[call] failed to notify call-end after start error", sendErr);
          }
        }
        stopRingbackRef.current?.();
        stopRingbackRef.current = null;
        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }
        const msg =
          e instanceof CallTokenUnauthorizedError
            ? "Сессия истекла. Войдите снова."
            : e instanceof Error && e.name === "NotSupportedError"
              ? "Звонки не поддерживаются. Откройте сайт по HTTPS."
              : e instanceof Error
                ? e.message
                : "Не удалось начать звонок";
        setError(msg);
        setState("idle");
        cleanup();
        toast({ title: msg, variant: "destructive" });
        if (e instanceof CallTokenUnauthorizedError) refetchAuth().catch(() => {});
      }
    },
    [myUserId, cleanup, refetchAuth, runOutgoingCall, ensureOpenWs]
  );

  const acceptCall = useCallback(async () => {
    const info = incoming;
    const offer = pendingOfferRef.current;
    if (!info || !myUserId) return;
    let ws = wsRef.current;
    if (ws?.readyState !== 1) {
      try {
        ws = await ensureOpenWs();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Нет соединения с сервером звонков";
        setError(msg);
        setState("idle");
        toast({ title: msg, variant: "destructive" });
        return;
      }
    }
    if (!ws || ws.readyState !== 1) {
      setError("Нет соединения с сервером звонков");
      setState("idle");
      return;
    }
    if (!isWebRtcSupported()) {
      setError("Звонки не поддерживаются в этом браузере. Откройте сайт в Safari/Chrome по HTTPS.");
      setState("idle");
      toast({ title: "Звонки не поддерживаются в этом браузере", variant: "destructive" });
      try {
        ws.send(JSON.stringify({ type: "call-reject", targetUserId: info.fromUserId }));
      } catch {}
      setIncoming(null);
      return;
    }
    stopIncomingAlertRef.current?.();
    stopIncomingAlertRef.current = null;
    setError(null);
    setDirection("incoming");
    otherUserIdRef.current = info.fromUserId;
    otherNameRef.current = info.fromDisplayName ?? null;
    chatIdRef.current = info.chatId;
    setIsVideo(info.video);
    setIncoming(null);

    const hasOffer = offer && typeof offer === "object" && "sdp" in offer;

    if (!hasOffer) {
      setState("connecting");
      acceptingWaitingOfferRef.current = true;
      acceptingVideoRef.current = info.video;
      if (connectingOfferTimeoutRef.current) {
        clearTimeout(connectingOfferTimeoutRef.current);
      }
      connectingOfferTimeoutRef.current = setTimeout(() => {
        connectingOfferTimeoutRef.current = null;
        if (acceptingWaitingOfferRef.current) {
          acceptingWaitingOfferRef.current = false;
          setError("Таймаут подключения. Попробуйте позвонить снова.");
          setState("idle");
          cleanup();
        }
      }, CONNECTING_OFFER_TIMEOUT_MS);
      try {
        const stream = await getUserMediaWithFallback(info.video);
        localStreamRef.current = stream;
        setLocalStream(stream);
        // Offer мог прийти пока ждали stream — создаём peer сейчас
        const offerNow = pendingOfferRef.current;
        const hasOfferNow = offerNow && typeof offerNow === "object" && "sdp" in offerNow;
        if (acceptingWaitingOfferRef.current && hasOfferNow && wsRef.current?.readyState === 1) {
          acceptingWaitingOfferRef.current = false;
          if (connectingOfferTimeoutRef.current) {
            clearTimeout(connectingOfferTimeoutRef.current);
            connectingOfferTimeoutRef.current = null;
          }
          const targetId = info.fromUserId;
          const sdp = offerNow as { sdp?: string };
          const offerSdp = sdp?.sdp ?? "";
          if (!offerSdp) {
            setError("Ошибка соединения");
            setState("idle");
            cleanup();
            return;
          }
          try {
            const peer = new SimplePeer({
              initiator: false,
              stream,
              trickle: true,
              config: { iceServers: getIceServers() },
              sdpTransform: transformPeerSdp,
            });
            peerRef.current = peer;
            attachConnectionState(peer);
            peer.on("signal", (data) => sendSignal(data as { type?: string; sdp?: string; candidate?: string; sdpMLineIndex?: number; sdpMid?: string }));
            peer.on("connect", () => setState("in-call"));
            peer.on("stream", (stream) => setRemoteStream(stream));
            peer.on("error", (err) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[call] peer error:", err);
              cleanupPeerOnly();
              setError(msg.includes("ICE") || msg.includes("connection") ? "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова." : "Ошибка соединения");
              setState("failed");
            });
            peer.on("close", () => endCall());
            wsRef.current.send(JSON.stringify({ type: "call-accept", targetUserId: targetId, video: info.video }));
            peer.signal({ type: "offer", sdp: offerSdp });
            pendingIceRef.current.forEach((c) => peer.signal({ type: "candidate", ...c }));
            pendingIceRef.current = [];
          } catch (e) {
            console.error("[call] accept (after stream) on offer:", e);
            setError("Ошибка соединения");
            setState("idle");
            cleanup();
          }
        }
      } catch (err) {
        acceptingWaitingOfferRef.current = false;
        if (connectingOfferTimeoutRef.current) {
          clearTimeout(connectingOfferTimeoutRef.current);
          connectingOfferTimeoutRef.current = null;
        }
        const msg = mapMediaAccessError(err);
        setError(msg);
        setState("idle");
      }
      return;
    }

    setState("connecting");
    pendingOfferRef.current = null;

    try {
      let stream: MediaStream;
      try {
        stream = await getUserMediaWithFallback(info.video);
      } catch (err) {
        throw new Error(mapMediaAccessError(err));
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const peer = new SimplePeer({
        initiator: false,
        stream,
        trickle: true,
        config: { iceServers: getIceServers() },
        sdpTransform: transformPeerSdp,
      });
      peerRef.current = peer;
      attachConnectionState(peer);

      peer.on("signal", (data) => sendSignal(data as { type?: string; sdp?: string; candidate?: string; sdpMLineIndex?: number; sdpMid?: string }));
      peer.on("connect", () => setState("in-call"));
      peer.on("stream", (stream) => setRemoteStream(stream));
      peer.on("error", (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[call] peer error:", err);
        cleanupPeerOnly();
        setError(msg.includes("ICE") || msg.includes("connection") ? "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова." : "Ошибка соединения");
        setState("failed");
      });
      peer.on("close", () => endCall());

      ws.send(JSON.stringify({ type: "call-accept", targetUserId: info.fromUserId, video: info.video }));

      try {
        peer.signal({ type: "offer", sdp: offer.sdp ?? "" });
        pendingIceRef.current.forEach((c) => peer.signal({ type: "candidate", ...c }));
        pendingIceRef.current = [];
      } catch (e) {
        console.error("[call] peer.signal(offer) in acceptCall error:", e);
        setError("Ошибка при установке соединения. Попробуйте позвонить снова.");
        setState("idle");
        cleanup();
        return;
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "NotSupportedError"
          ? "Звонки не поддерживаются. Откройте сайт по HTTPS."
          : e instanceof Error
            ? e.message
            : "Ошибка";
      setError(msg);
      setState("idle");
      cleanup();
    }
  }, [incoming, myUserId, cleanup, sendSignal, endCall, cleanupPeerOnly, attachConnectionState, ensureOpenWs, isWebRtcSupported, getUserMediaWithFallback, mapMediaAccessError]);

  const rejectCall = useCallback(() => {
    stopIncomingAlertRef.current?.();
    stopIncomingAlertRef.current = null;
    const from = incoming?.fromUserId;
    if (wsRef.current?.readyState === 1 && from) {
      wsRef.current.send(JSON.stringify({ type: "call-reject", targetUserId: from }));
    }
    setIncoming(null);
    setState("idle");
  }, [incoming]);

  const retryCall = useCallback(() => {
    const uid = otherUserIdRef.current;
    const name = otherNameRef.current;
    const cid = chatIdRef.current;
    if (uid && cid) {
      setError(null);
      startCall(uid, name ?? null, cid, isVideo);
    }
  }, [startCall, isVideo]);

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    // Не дергать /api/calls/token на странице входа — там сессии нет, только 401 и тост «Сессия истекла».
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    if (pathname === "/login" || pathname.startsWith("/login?")) return;
    let mounted = true;
    const connect = (retryCount = 0) => {
      // Уже есть открытое соединение — не создавать второе (звонки идут по нему же)
      if (wsRef.current?.readyState === 1) return;
      getCallToken()
        .then((token) => {
          if (!mounted) return;
          if (wsRef.current?.readyState === 1) return;
          const ws = new WebSocket(getCallWsUrl(token));
          wsRef.current = ws;
          attachWsHandlersRef.current(ws);
        })
        .catch((err) => {
          if (!mounted) return;
          if (err instanceof CallTokenUnauthorizedError) {
            // После логина cookie может примениться не мгновенно (особенно в мобильных webview).
            // Делаем несколько фоновых попыток вместо немедленного отказа.
            if (retryCount < BACKGROUND_CONNECT_MAX_RETRIES) {
              setTimeout(() => connect(retryCount + 1), 1200 * (retryCount + 1));
            } else {
              refetchAuth().catch(() => {});
            }
            return;
          }
          if (retryCount < BACKGROUND_CONNECT_MAX_RETRIES) {
            setTimeout(() => connect(retryCount + 1), 1000 * (retryCount + 1));
          }
        });
    };
    scheduleReconnectRef.current = () => {
      if (!mounted || !myUserId) return;
      setTimeout(() => connect(0), 2000);
    };
    // Даём время куке сессии примениться после входа (1.5 с), чтобы не летел 401 на первый же запрос.
    const t = setTimeout(connect, 1500);

    // При возврате на вкладку/в приложение — если сокет закрыт, переподключиться сразу
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !mounted || !myUserId) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === 2 || ws.readyState === 3) {
        scheduleReconnectRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const cleanup = () => {
      mounted = false;
      scheduleReconnectRef.current = null;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      closeWs();
    };
    return cleanup;
  }, [myUserId, closeWs, refetchAuth]);

  return {
    state,
    direction,
    isVideo,
    isMuted,
    setMuted,
    incoming,
    setIncoming,
    error,
    endCall,
    startCall,
    subscribeChat,
    sendTyping,
    subscribeTyping,
    sendVoiceRecording,
    subscribeVoiceRecording,
    acceptCall,
    rejectCall,
    localStreamRef,
    localStream,
    remoteStream,
    connectionState,
    retryCall,
  };
}
