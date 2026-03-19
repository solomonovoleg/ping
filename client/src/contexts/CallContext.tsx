import { createContext, useContext } from "react";
import { useCallStore } from "@/features/call/useCallStore";
import { CallModal } from "@/components/CallModal";

type CallContextValue = ReturnType<typeof useCallStore>;

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const call = useCallStore();

  const otherName = call.incoming?.fromDisplayName ?? call.otherDisplayName ?? "Абонент";
  const otherAvatar = call.incoming?.fromAvatarUrl ?? call.otherAvatarUrl ?? null;
  const otherUserId = call.incoming?.fromUserId ?? call.otherUserId ?? null;

  return (
    <CallContext.Provider value={call}>
      {children}
      <CallModal
        state={call.state}
        isVideo={call.mediaType === "video"}
        isMuted={call.isMuted}
        onSetMuted={call.setMuted}
        onEndCall={call.hangup}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
        incoming={call.incoming}
        error={call.error}
        statusText={call.statusText}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
        connectionState={call.connectionState}
        onRetry={call.retryCall}
        otherDisplayName={otherName}
        otherAvatarUrl={otherAvatar}
        otherUserId={otherUserId}
      />
    </CallContext.Provider>
  );
}

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}
