/** События realtime-конверта (WS `GET /v1/realtime`, webhooks). */
export type HubRealtimeEvent =
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "message.reactions.updated"
  | "message.transcript.updated"
  | "message.delivered"
  | "message.read"
  | "presence.updated";

export type HubRealtimeChannel = "message" | "receipt" | "presence";

/** Envelope как в JSON по сокету / в webhook. */
export type HubRealtimeEnvelope<TPayload = unknown> = {
  id: string;
  partnerId: string;
  channel: HubRealtimeChannel;
  event: HubRealtimeEvent;
  payload: TPayload;
  emittedAt: string;
};

/** Payload событий моста платформы (`source: ping_platform`). */
export type HubPingPlatformPayloadBase = {
  chatId: string;
  recipientPingUserId: string;
  source: "ping_platform";
};

export type HubPingPlatformMessageCreatedPayload = HubPingPlatformPayloadBase & {
  message: Record<string, unknown>;
};

export type HubPingPlatformMessageUpdatedPayload = HubPingPlatformPayloadBase & {
  messageId: string;
  content: string;
};

export type HubPingPlatformMessageDeletedPayload = HubPingPlatformPayloadBase & {
  messageId: string;
};

export type HubPingPlatformReactionsPayload = HubPingPlatformPayloadBase & {
  messageId: string;
  reactions: Array<{ emoji: string; count: number }>;
  actorUserId: string;
  emoji: string | null;
};

export type HubPingPlatformTranscriptPayload = HubPingPlatformPayloadBase & {
  message: Record<string, unknown>;
};

export function isPingPlatformBridgePayload(
  p: unknown
): p is HubPingPlatformPayloadBase & Record<string, unknown> {
  return (
    typeof p === "object" &&
    p !== null &&
    (p as HubPingPlatformPayloadBase).source === "ping_platform" &&
    typeof (p as HubPingPlatformPayloadBase).chatId === "string" &&
    typeof (p as HubPingPlatformPayloadBase).recipientPingUserId === "string"
  );
}
