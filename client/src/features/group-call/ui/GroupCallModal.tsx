import { useEffect, useMemo, useState } from "react";
import { PULSE_CALL_BACKDROP_CLASS } from "@/features/call/ui/pulse-call-spec";
import { cn } from "@/lib/utils";
import type { GroupCallMedia } from "@/lib/group-calls-api";
import { useGroupCallSession } from "../session/useGroupCallSession";
import { AddCallSegmentsToTrackModal } from "@/features/board/call-history/AddCallSegmentsToTrackModal";
import { GroupCommandPrompt } from "./GroupCommandPrompt";
import { GroupCallAILayout } from "./pulse-ai/GroupCallAILayout";
import { getCallFeatureFlags } from "@/features/call/call-feature-flags";
import { getCallFeatureSupport } from "@/features/call/call-capabilities";

type Props = {
  chatId: string;
  chatTitle: string;
  roomId: string;
  mediaType: GroupCallMedia;
  myUserId: string;
  myDisplayName: string;
  /** Организатор (из API) — порядок плиток до первого roster. */
  hostUserId?: string | null;
  open: boolean;
  onClose: () => void;
};

export function GroupCallModal({
  chatId,
  chatTitle,
  roomId,
  mediaType,
  myUserId,
  myDisplayName,
  hostUserId: hostUserIdProp = null,
  open,
  onClose,
}: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [segmentsForSave, setSegmentsForSave] = useState<Array<{ id: string }>>([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const supports = useMemo(() => getCallFeatureSupport(getCallFeatureFlags()), []);
  const session = useGroupCallSession({
    roomId,
    mediaType,
    myUserId,
    myDisplayName,
    open,
    onEnded: onClose,
    initialHostUserId: hostUserIdProp,
  });

  useEffect(() => {
    setElapsedSec(0);
  }, [roomId]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setElapsedSec((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  const suggestedSegments = useMemo(() => {
    const ids = new Set(
      session.pendingSuggestions.flatMap((item) => {
        try {
          const payload = JSON.parse(item.payloadJson) as { segmentIds?: string[] };
          return payload.segmentIds ?? [];
        } catch {
          return item.segmentId ? [item.segmentId] : [];
        }
      }),
    );
    return session.transcriptSegments.filter((segment) => ids.has(segment.id));
  }, [session.pendingSuggestions, session.transcriptSegments]);

  const activeSuggestion = session.pendingSuggestions[0] ?? null;

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[500] flex h-full w-full flex-col overflow-hidden text-white",
        PULSE_CALL_BACKDROP_CLASS,
      )}
      role="dialog"
      aria-modal
      aria-label={`Групповой звонок: ${chatTitle}`}
    >
      <GroupCallAILayout
        chatId={chatId}
        chatTitle={chatTitle}
        myUserId={myUserId}
        myDisplayName={myDisplayName}
        elapsedSec={elapsedSec}
        session={{
          phase: session.phase,
          error: session.error,
          participants: session.participants,
          hostUserId: session.hostUserId,
          centerUserId: session.centerUserId,
          activeSpeakerId: session.activeSpeakerId,
          isVideo: session.isVideo,
          isMuted: session.isMuted,
          setMuted: session.setMuted,
          isCameraOff: session.isCameraOff,
          setCameraOff: session.setCameraOff,
          getRemoteStream: session.getRemoteStream,
          localStream: session.localStream,
          localStreamRenderKey: session.localStreamRenderKey,
          transcriptSegments: session.transcriptSegments,
          captionsEnabled: session.captionsEnabled,
          toggleCaptions: session.toggleCaptions,
          canToggleTranscripts: session.canToggleTranscripts,
          isScreenSharing: session.isScreenSharing,
          toggleScreenShare: session.toggleScreenShare,
          hangup: session.hangup,
          handRaisedUserIds: session.handRaisedUserIds,
          setHandRaised: session.setHandRaised,
          sendGroupReaction: session.sendGroupReaction,
          maxMeshPeers: session.maxMeshPeers,
        }}
        supportsScreenShare={supports.screenShare}
        commandPrompt={
          <GroupCommandPrompt
            suggestion={activeSuggestion}
            previewSegments={suggestedSegments}
            onAccept={async () => {
              if (!activeSuggestion) return;
              const payloadSegments =
                suggestedSegments.length > 0
                  ? suggestedSegments.map((segment) => ({ id: segment.id }))
                  : activeSuggestion.segmentId
                    ? [{ id: activeSuggestion.segmentId }]
                    : [];
              setSegmentsForSave(payloadSegments);
              await session.resolveSuggestion(activeSuggestion.callId, activeSuggestion.id, "accepted");
              setSaveOpen(true);
            }}
            onDismiss={() =>
              activeSuggestion &&
              session.resolveSuggestion(activeSuggestion.callId, activeSuggestion.id, "dismissed")
            }
          />
        }
      />

      <AddCallSegmentsToTrackModal
        isOpen={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setSegmentsForSave([]);
        }}
        segments={segmentsForSave}
      />
    </div>
  );
}
