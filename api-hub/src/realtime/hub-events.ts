import { createId } from "../lib/ids.js";
import { bumpRealtimeEvent } from "../middleware/metrics.js";
import type { ChatChannel, RealtimeEnvelope } from "../types.js";
import { webhookService } from "../webhooks/webhook-service.js";
import { realtimeBroker } from "./realtime-broker.js";
import { getRedisBridge } from "./redis-bridge.js";

export function emitHubEvent<T>(input: {
  partnerId: string;
  channel: ChatChannel;
  event: RealtimeEnvelope<T>["event"];
  payload: T;
}): RealtimeEnvelope<T> {
  const envelope: RealtimeEnvelope<T> = {
    id: createId("evt"),
    partnerId: input.partnerId,
    channel: input.channel,
    event: input.event,
    payload: input.payload,
    emittedAt: new Date().toISOString(),
  };
  bumpRealtimeEvent();
  webhookService.enqueue(input.partnerId, envelope as RealtimeEnvelope);
  const bridge = getRedisBridge();
  if (bridge) {
    void bridge.publish(envelope as RealtimeEnvelope);
  } else {
    realtimeBroker.dispatchEnvelope(envelope as RealtimeEnvelope);
  }
  return envelope;
}
