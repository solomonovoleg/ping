import { createClient, type RedisClientType } from "redis";
import { config } from "../config.js";
import type { RealtimeEnvelope } from "../types.js";
import { realtimeBroker } from "./realtime-broker.js";

let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

let bridgeImpl: { publish: (envelope: RealtimeEnvelope) => Promise<void> } | null = null;

export function getRedisBridge(): { publish: (envelope: RealtimeEnvelope) => Promise<void> } | null {
  return bridgeImpl;
}

/**
 * Cross-process fanout: every instance subscribes and delivers to local WebSockets.
 */
export async function initRedisBridge(): Promise<void> {
  if (!config.redisUrl) return;
  const channel = config.redisChannel;
  pubClient = createClient({ url: config.redisUrl });
  subClient = createClient({ url: config.redisUrl });
  await pubClient.connect();
  await subClient.connect();
  await subClient.subscribe(channel, (message) => {
    try {
      const envelope = JSON.parse(message) as RealtimeEnvelope;
      realtimeBroker.dispatchEnvelope(envelope);
    } catch {
      /* ignore malformed */
    }
  });
  bridgeImpl = {
    async publish(envelope: RealtimeEnvelope) {
      await pubClient!.publish(channel, JSON.stringify(envelope));
    },
  };
}

export async function closeRedisBridge(): Promise<void> {
  await Promise.all([pubClient?.quit(), subClient?.quit()]);
  pubClient = null;
  subClient = null;
  bridgeImpl = null;
}
