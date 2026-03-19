import { createContext, useContext, useRef, type MutableRefObject } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSocket } from "@/hooks/useRealtimeSocket";

type CallMessageHandlerRef = MutableRefObject<(raw: Record<string, unknown>) => void>;
type SocketDisconnectedRef = MutableRefObject<() => void>;

type RealtimeContextValue = ReturnType<typeof useRealtimeSocket> & {
  callMessageHandlerRef: CallMessageHandlerRef;
  onSocketDisconnectedRef: SocketDisconnectedRef;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, refetch } = useAuth();
  const callMessageHandlerRef = useRef<(raw: Record<string, unknown>) => void>(() => {});
  const onSocketDisconnectedRef = useRef<() => void>(() => {});
  const realtime = useRealtimeSocket({
    userId: user?.id,
    refetchAuth: refetch,
    callMessageHandlerRef,
    onSocketDisconnectedRef,
  });

  return (
    <RealtimeContext.Provider value={{ ...realtime, callMessageHandlerRef, onSocketDisconnectedRef }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtimeContext must be used within RealtimeProvider");
  return ctx;
}
