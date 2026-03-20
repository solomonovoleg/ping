import { useRoute } from "wouter";
import { CallHistoryDetailView } from "@/features/board/call-history/CallHistoryDetailView";

export default function BoardCallHistoryDetail() {
  const [, params] = useRoute("/board/calls/:callId");
  const callId = params?.callId ?? "";
  if (!callId) return null;
  return <CallHistoryDetailView callId={callId} />;
}
