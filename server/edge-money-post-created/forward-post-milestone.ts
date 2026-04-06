import { fetchUpstreamEdgeServicePath } from "../edge/upstream-client";

export type PostCreatedMilestoneEdgePayload = {
  edgeId: string;
  platformUserId: string;
  blockIndex: number;
};

export async function forwardPostCreatedMilestoneToEdge(payload: PostCreatedMilestoneEdgePayload): Promise<void> {
  const body = JSON.stringify({
    type: "post_created_milestone",
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
      console.warn("[edge-money-post-created] EDGE milestone", up.ok ? up.status : "no_upstream");
    }
  } catch (e) {
    console.error("[edge-money-post-created] forward milestone", e);
  }
}
