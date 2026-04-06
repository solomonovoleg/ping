import { fetchUpstreamEdgeServicePath } from "../edge/upstream-client";

export type VideoCallMilestonePayload = {
  edgeId: string;
  platformUserId: string;
  chatId: string;
  blockIndex: number;
};

export async function forwardVideoCallMinutesMilestoneToEdge(payload: VideoCallMilestonePayload): Promise<void> {
  const body = JSON.stringify({
    type: "video_call_minutes_milestone",
    edgeId: payload.edgeId.trim(),
    platformUserId: payload.platformUserId.trim(),
    chatId: payload.chatId.trim(),
    blockIndex: Math.floor(payload.blockIndex),
  });
  try {
    const up = await fetchUpstreamEdgeServicePath("/v1/money/platform-events", {
      method: "POST",
      body,
    });
    if (!up.ok || up.status < 200 || up.status >= 300) {
      console.warn("[edge-money-call-minutes] EDGE milestone", up.ok ? up.status : "no_upstream");
    }
  } catch (e) {
    console.error("[edge-money-call-minutes] forward", e);
  }
}
