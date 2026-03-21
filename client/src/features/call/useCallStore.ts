import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CallController, type CallControllerSnapshot } from "./call-controller";
import { CallSignalingClient } from "./call-signaling";
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
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
};

/**
 * React hook wrapping CallController.
 * Creates controller once, subscribes to snapshot changes, exposes actions.
 */
export function useCallStore() {
  const { user } = useAuth();
  const realtime = useRealtimeContext();
  const [snapshot, setSnapshot] = useState<CallControllerSnapshot>(INITIAL_SNAPSHOT);

  const signalingRef = useRef<CallSignalingClient | null>(null);
  const controllerRef = useRef<CallController | null>(null);

  if (!signalingRef.current) {
    signalingRef.current = new CallSignalingClient(realtime.sendJson);
  }

  useEffect(() => {
    signalingRef.current?.updateTransport(realtime.sendJson);
  }, [realtime.sendJson]);

  useEffect(() => {
    if (!user?.id || !signalingRef.current) return;

    const ctrl = new CallController(signalingRef.current, user.id);
    controllerRef.current = ctrl;

    const unsub = ctrl.subscribe((snap) => setSnapshot(snap));

    return () => {
      unsub();
      ctrl.destroy();
      controllerRef.current = null;
    };
  }, [user?.id]);

  // Wire call message handler into the realtime transport
  useEffect(() => {
    const signaling = signalingRef.current;
    if (!signaling) return;
    realtime.callMessageHandlerRef.current = (raw) => {
      signaling.handleRawMessage(raw);
    };
  }, [realtime.callMessageHandlerRef]);

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
        [user.displayName, user.surname].filter(Boolean).join(" ").trim() || user.phone || "Абонент";
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

  const toggleCameraEnabled = useCallback(() => {
    controllerRef.current?.toggleCameraEnabled();
  }, []);

  const retryCall = useCallback(() => {
    controllerRef.current?.retryCall();
  }, []);

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

  const actions: CallStoreActions = useMemo(
    () => ({
      startCall,
      acceptCall,
      rejectCall,
      hangup,
      setMuted,
      toggleCameraEnabled,
      switchCamera,
      toggleScreenShare,
      toggleRecording,
      toggleRecordingPause,
      sendReaction,
      toggleCaptions,
      retryCall,
    }),
    [
      startCall,
      acceptCall,
      rejectCall,
      hangup,
      setMuted,
      toggleCameraEnabled,
      switchCamera,
      toggleScreenShare,
      toggleRecording,
      toggleRecordingPause,
      sendReaction,
      toggleCaptions,
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
