import { fetchUpstreamEdgeServicePath } from "../edge/upstream-client";

export type ChatMilestoneEdgePayload = {
  edgeId: string;
  platformUserId: string;
  chatId: string;
  blockIndex: number;
};

export async function forwardChatMessagesMilestoneToEdge(payload: ChatMilestoneEdgePayload): Promise<void> {
  const body = JSON.stringify({
    type: "chat_messages_milestone",
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
      console.warn("[edge-money-chat-messages] EDGE milestone", up.ok ? up.status : "no_upstream");
    }
  } catch (e) {
    console.error("[edge-money-chat-messages] forward milestone", e);
  }
}
