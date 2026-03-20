import { createContext, useContext, useMemo, useRef, type MutableRefObject } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSocket } from "@/hooks/useRealtimeSocket";

type CallMessageHandlerRef = MutableRefObject<(raw: Record<string, unknown>) => void>;
type SocketDisconnectedRef = MutableRefObject<() => void>;
type SocketConnectedRef = MutableRefObject<() => void>;

type RealtimeContextValue = ReturnType<typeof useRealtimeSocket> & {
  callMessageHandlerRef: CallMessageHandlerRef;
  onSocketDisconnectedRef: SocketDisconnectedRef;
  onSocketConnectedRef: SocketConnectedRef;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, refetch } = useAuth();
  const callMessageHandlerRef = useRef<(raw: Record<string, unknown>) => void>(() => {});
  const onSocketDisconnectedRef = useRef<() => void>(() => {});
  const onSocketConnectedRef = useRef<() => void>(() => {});
  const {
    wsRef,
    ensureOpenWs,
    closeWs,
    sendJson,
    subscribeChat,
    subscribeMessageDeleted,
    sendTyping,
    subscribeTyping,
    sendVoiceRecording,
    subscribeVoiceRecording,
  } = useRealtimeSocket({
    userId: user?.id,
    refetchAuth: refetch,
    callMessageHandlerRef,
    onSocketDisconnectedRef,
    onSocketConnectedRef,
  });

  const value = useMemo(
    () => ({
      wsRef,
      ensureOpenWs,
      closeWs,
      sendJson,
      subscribeChat,
      subscribeMessageDeleted,
      sendTyping,
      subscribeTyping,
      sendVoiceRecording,
      subscribeVoiceRecording,
      callMessageHandlerRef,
      onSocketDisconnectedRef,
      onSocketConnectedRef,
    }),
    [
      wsRef,
      ensureOpenWs,
      closeWs,
      sendJson,
      subscribeChat,
      subscribeMessageDeleted,
      sendTyping,
      subscribeTyping,
      sendVoiceRecording,
      subscribeVoiceRecording,
      callMessageHandlerRef,
      onSocketDisconnectedRef,
      onSocketConnectedRef,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeContext(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtimeContext must be used within RealtimeProvider");
  return ctx;
}
