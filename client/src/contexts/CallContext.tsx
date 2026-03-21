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
        chatId={call.chatId}
        subscribeChat={call.subscribeChat}
        callMessageContext={call.callMessageContext}
        state={call.state}
        direction={call.direction}
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
        networkQuality={call.networkQuality}
        supports={call.supports}
        isScreenShareActive={call.isScreenShareActive}
        remoteScreenShareActive={call.remoteScreenShareActive}
        isCameraEnabled={call.isCameraEnabled}
        localRecordingState={call.localRecordingState}
        localRecordingElapsedMs={call.localRecordingElapsedMs}
        captionsEnabled={call.captionsEnabled}
        localReactions={call.localReactions}
        remoteReactions={call.remoteReactions}
        captions={call.captions}
        onSwitchCamera={call.switchCamera}
        onToggleCameraEnabled={call.toggleCameraEnabled}
        onToggleScreenShare={call.toggleScreenShare}
        onToggleRecording={call.toggleRecording}
        onToggleRecordingPause={call.toggleRecordingPause}
        onToggleCaptions={call.toggleCaptions}
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
