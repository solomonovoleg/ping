import { createContext, useContext } from "react";
import { useCall } from "@/hooks/useCall";
import { CallModal } from "@/components/CallModal";
import { useAuth } from "./AuthContext";

type CallContextValue = ReturnType<typeof useCall>;

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const call = useCall(user?.id);

  return (
    <CallContext.Provider value={call}>
      {children}
      <CallModal
        state={call.state}
        isVideo={call.isVideo}
        isMuted={call.isMuted}
        onSetMuted={call.setMuted}
        onEndCall={call.endCall}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
        incoming={call.incoming}
        error={call.error}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
        connectionState={call.connectionState}
        onRetry={call.retryCall}
      />
    </CallContext.Provider>
  );
}

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}
