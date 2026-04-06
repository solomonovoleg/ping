import type { WebSocket } from "ws";
import { createId } from "../lib/ids.js";
import type { ChatChannel, RealtimeEnvelope } from "../types.js";

interface SocketMeta {
  ws: WebSocket;
  partnerId: string;
  pingUserId: string;
  channels: Set<ChatChannel>;
}

export class RealtimeBroker {
  private readonly sockets = new Map<string, SocketMeta>();
  private readonly listeners = new Set<(event: RealtimeEnvelope) => void>();

  register(input: { id: string; ws: WebSocket; partnerId: string; pingUserId: string }): void {
    this.sockets.set(input.id, {
      ws: input.ws,
      partnerId: input.partnerId,
      pingUserId: input.pingUserId,
      channels: new Set(["message", "receipt", "presence"]),
    });
  }

  unregister(id: string): void {
    this.sockets.delete(id);
  }

  onEmit(listener: (event: RealtimeEnvelope) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSocket(id: string): SocketMeta | undefined {
    return this.sockets.get(id);
  }

  setChannels(socketId: string, channels: ChatChannel[]): void {
    const found = this.sockets.get(socketId);
    if (!found) return;
    found.channels = new Set(channels);
    this.sockets.set(socketId, found);
  }

  dispatchEnvelope(envelope: RealtimeEnvelope): void {
    const raw = JSON.stringify(envelope);
    for (const item of this.sockets.values()) {
      if (item.partnerId !== envelope.partnerId) continue;
      if (!item.channels.has(envelope.channel)) continue;
      item.ws.send(raw);
    }
    for (const listener of this.listeners) {
      listener(envelope);
    }
  }

  emit<T>(input: {
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
    this.dispatchEnvelope(envelope);
    return envelope;
  }
}

export const realtimeBroker = new RealtimeBroker();
