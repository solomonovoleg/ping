import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { CallController, type CallControllerSnapshot } from "./call-controller";
import { CallSignalingClient } from "./call-signaling";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { API, apiFetch } from "@/lib/api-base";
import type { CallMediaType, CallStoreActions, CallReactionKind, CallMessageListContext } from "./call-types";

const INITIAL_SNAPSHOT: CallControllerSnapshot = {
  state: "idle",
  direction: "outgoing",
  callId: null,
  mediaType: "audio",
  isMuted: false,
  error: null,
  statusText: null,
  incoming: null,
  localStream: null,
  remoteStream: null,
  connectionState: null,
  networkQuality: "unknown",
  videoQualityMode: "auto",
  cameraFacingMode: "user",
  isScreenShareActive: false,
  remoteScreenShareActive: false,
  isCameraEnabled: true,
  localRecordingState: "idle",
  localRecordingElapsedMs: 0,
  captionsEnabled: false,
  supports: {
    networkQuality: false,
    cameraFlip: false,
    screenShare: false,
    localRecording: false,
    reactions: false,
    captionsRelay: false,
    captionsLocalSTT: false,
  },
  localReactions: [],
  remoteReactions: [],
  captions: [],
  otherUserId: null,
  otherDisplayName: null,
  otherAvatarUrl: null,
  chatId: null,
  callMessageContext: { kind: "unknown" },
  audioOutputSpeaker: true,
};

/**
 * React hook wrapping CallController.
 * Creates controller once, subscribes to snapshot changes, exposes actions.
 */
export function useCallStore() {
  const { user } = useAuth();
  const realtime = useRealtimeContext();
  const realtimeRef = useRef(realtime);
  realtimeRef.current = realtime;
  const [snapshot, setSnapshot] = useState<CallControllerSnapshot>(INITIAL_SNAPSHOT);

  const signalingRef = useRef<CallSignalingClient | null>(null);
  const controllerRef = useRef<CallController | null>(null);

  if (!signalingRef.current) {
    signalingRef.current = new CallSignalingClient(realtime.sendJson);
  }

  useEffect(() => {
    signalingRef.current?.updateTransport(realtime.sendJson);
  }, [realtime.sendJson]);

  /**
   * useLayoutEffect: сразу вешаем callMessageHandlerRef до отрисовки, чтобы первое call.incoming
   * с WS не ушло в пустой ref между эффектами.
   */
  useLayoutEffect(() => {
    const signaling = signalingRef.current;
    if (!signaling) return;

    const { callMessageHandlerRef } = realtimeRef.current;
    callMessageHandlerRef.current = (raw) => signaling.handleRawMessage(raw);

    if (!user?.id) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setSnapshot(INITIAL_SNAPSHOT);
      return () => {
        realtimeRef.current.callMessageHandlerRef.current = () => {};
      };
    }

    const ctrl = new CallController(signaling, user.id);
    controllerRef.current = ctrl;

    const unsub = ctrl.subscribe((snap) => setSnapshot(snap));

    return () => {
      realtimeRef.current.callMessageHandlerRef.current = () => {};
      unsub();
      ctrl.destroy();
      controllerRef.current = null;
      setSnapshot(INITIAL_SNAPSHOT);
    };
  }, [user?.id]);

  // Wire transport disconnect → controller
  useEffect(() => {
    realtime.onSocketDisconnectedRef.current = () => {
      controllerRef.current?.onTransportDisconnected();
    };
  }, [realtime.onSocketDisconnectedRef]);

  useEffect(() => {
    realtime.onSocketConnectedRef.current = () => {
      controllerRef.current?.onTransportConnected();
    };
  }, [realtime.onSocketConnectedRef]);

  /** iOS: VoIP-токен на сервер + ответ/сброс из CallKit → WebRTC. */
  useEffect(() => {
    if (!user?.id) return;
    let platform: string;
    try {
      platform = Capacitor.getPlatform();
    } catch {
      return;
    }
    if (platform !== "ios") return;

    let cancelled = false;
    let removeVoip: (() => void) | undefined;
    let removeKit: (() => void) | undefined;

    const postVoipToken = (token: string) =>
      apiFetch(`${API}/users/me/voip-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        suppressSessionExpireOn401: true,
      }).catch(() => {});

    const processCallKitPayload = async (raw: Record<string, string>) => {
      const action = raw.action;
      const callId = raw.callId;
      const fromUserId = raw.fromUserId;
      const chatId = raw.chatId;
      if (!action || !callId || !fromUserId || !chatId) return;
      const mediaType: CallMediaType = raw.mediaType === "video" ? "video" : "audio";
      const fromDisplayName = raw.fromDisplayName?.trim() || "Абонент";
      const ctrl = controllerRef.current;
      if (!ctrl || cancelled) return;
      try {
        await realtimeRef.current.ensureOpenWs();
      } catch {
        return;
      }
      ctrl.applyIncomingRingingFromNativeVoip(
        {
          callId,
          fromUserId,
          fromDisplayName,
          fromAvatarUrl: null,
          chatId,
          mediaType,
        },
        { skipAlert: true },
      );
      if (action === "answer") {
        await ctrl.acceptCall();
      } else if (action === "reject") {
        ctrl.rejectCall();
      }
    };

    void (async () => {
      const { PingCallKitVoip } = await import("@/lib/ping-callkit-voip");
      const hVoip = await PingCallKitVoip.addListener("pingVoipToken", (ev) => {
        const t = typeof ev?.token === "string" ? ev.token.trim() : "";
        if (t && !cancelled) void postVoipToken(t);
      });
      removeVoip = () => void hVoip.remove();

      const hKit = await PingCallKitVoip.addListener("pingCallKitAction", (ev) => {
        void processCallKitPayload(ev as Record<string, string>);
      });
      removeKit = () => void hKit.remove();

      try {
        const { actions } = await PingCallKitVoip.getPendingCallKitActions();
        for (const a of actions) {
          await processCallKitPayload(a);
        }
      } catch {
        /* */
      }
    })();

    return () => {
      cancelled = true;
      removeVoip?.();
      removeKit?.();
    };
  }, [user?.id]);

  const startCall = useCallback(
    async (
      otherUserId: string,
      otherName: string | null,
      chatId: string,
      video: boolean,
      avatarUrl?: string | null,
      messageContext?: CallMessageListContext,
    ) => {
      const ctrl = controllerRef.current;
      if (!ctrl || !user) {
        toast({ title: "Невозможно позвонить: не авторизованы", variant: "destructive" });
        return;
      }
      const callerDisplayName =
        [user.displayName, user.surname].filter(Boolean).join(" ").trim() || `ID ${user.publicId}`;
      const mediaType: CallMediaType = video ? "video" : "audio";

      try {
        await realtime.ensureOpenWs();
        await ctrl.startCall(
          otherUserId,
          otherName,
          avatarUrl ?? null,
          chatId,
          mediaType,
          callerDisplayName,
          messageContext ?? { kind: "unknown" },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось начать звонок";
        toast({ title: msg, variant: "destructive" });
      }
    },
    [user, realtime],
  );

  const acceptCall = useCallback(async () => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    try {
      await realtime.ensureOpenWs();
      await ctrl.acceptCall();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка при принятии звонка";
      toast({ title: msg, variant: "destructive" });
    }
  }, [realtime]);

  const rejectCall = useCallback(() => {
    controllerRef.current?.rejectCall();
  }, []);

  const hangup = useCallback(() => {
    controllerRef.current?.hangup();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    controllerRef.current?.setMuted(muted);
  }, []);

  const setAudioOutputSpeaker = useCallback((speaker: boolean) => {
    controllerRef.current?.setAudioOutputSpeaker(speaker);
  }, []);

  const toggleCameraEnabled = useCallback(() => {
    controllerRef.current?.toggleCameraEnabled();
  }, []);

  const retryCall = useCallback(() => {
    void (async () => {
      try {
        await realtime.ensureOpenWs();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось подключиться к серверу звонков";
        toast({ title: msg, variant: "destructive" });
        return;
      }
      controllerRef.current?.retryCall();
    })();
  }, [realtime]);

  const switchCamera = useCallback(async () => {
    await controllerRef.current?.switchCamera();
  }, []);

  const toggleScreenShare = useCallback(async () => {
    await controllerRef.current?.toggleScreenShare();
  }, []);

  const toggleRecording = useCallback(async () => {
    await controllerRef.current?.toggleRecording();
  }, []);

  const toggleRecordingPause = useCallback(async () => {
    await controllerRef.current?.toggleRecordingPause();
  }, []);

  const sendReaction = useCallback((reaction: CallReactionKind) => {
    controllerRef.current?.sendReaction(reaction);
  }, []);

  const toggleCaptions = useCallback(() => {
    controllerRef.current?.toggleCaptions();
  }, []);

  const toggleVideoHd = useCallback(() => {
    controllerRef.current?.toggleVideoHd();
  }, []);

  const actions: CallStoreActions = useMemo(
    () => ({
      startCall,
      acceptCall,
      rejectCall,
      hangup,
      setMuted,
      setAudioOutputSpeaker,
      toggleCameraEnabled,
      switchCamera,
      toggleScreenShare,
      toggleRecording,
      toggleRecordingPause,
      sendReaction,
      toggleCaptions,
      toggleVideoHd,
      retryCall,
    }),
    [
      startCall,
      acceptCall,
      rejectCall,
      hangup,
      setMuted,
      setAudioOutputSpeaker,
      toggleCameraEnabled,
      switchCamera,
      toggleScreenShare,
      toggleRecording,
      toggleRecordingPause,
      sendReaction,
      toggleCaptions,
      toggleVideoHd,
      retryCall,
    ],
  );

  return {
    ...snapshot,
    ...actions,
    // Chat realtime pass-through (kept for backward compat with pages that use useCallContext for chat subscriptions)
    subscribeChat: realtime.subscribeChat,
    subscribeMessageDeleted: realtime.subscribeMessageDeleted,
    sendTyping: realtime.sendTyping,
    subscribeTyping: realtime.subscribeTyping,
    sendVoiceRecording: realtime.sendVoiceRecording,
    subscribeVoiceRecording: realtime.subscribeVoiceRecording,
  };
}
