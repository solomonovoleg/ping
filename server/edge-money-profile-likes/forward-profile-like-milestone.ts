import { fetchUpstreamEdgeServicePath } from "../edge/upstream-client";

export type ProfileLikeMilestoneEdgePayload = {
  edgeId: string;
  platformUserId: string;
  blockIndex: number;
};

export async function forwardProfileLikeMilestoneToEdge(payload: ProfileLikeMilestoneEdgePayload): Promise<void> {
  const body = JSON.stringify({
    type: "profile_likes_received_milestone",
    edgeId: payload.edgeId.trim(),
    platformUserId: payload.platformUserId.trim(),
    blockIndex: Math.floor(payload.blockIndex),
  });
  try {
    const up = await fetchUpstreamEdgeServicePath("/v1/money/platform-events", {
      method: "POST",
      body,
    });
    if (!up.ok || up.status < 200 || up.status >= 300) {
      console.warn("[edge-money-profile-likes] EDGE milestone", up.ok ? up.status : "no_upstream");
    }
  } catch (e) {
    console.error("[edge-money-profile-likes] forward milestone", e);
  }
}
