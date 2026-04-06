import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { config } from "../config.js";
import { verifySessionToken } from "../security/token.js";
import { createId } from "../lib/ids.js";
import { realtimeBroker } from "./realtime-broker.js";
import type { ChatChannel, RealtimeEnvelope } from "../types.js";

type PendingEvent = {
  payload: string;
  tries: number;
  timer?: NodeJS.Timeout;
};

const pendingBySocket = new Map<string, Map<string, PendingEvent>>();

function scheduleRetry(socketId: string, ws: import("ws").WebSocket, envelope: RealtimeEnvelope): void {
  const pending = pendingBySocket.get(socketId);
  if (!pending) return;
  const item = pending.get(envelope.id);
  if (!item) return;
  item.timer = setTimeout(() => {
    const current = pending.get(envelope.id);
    if (!current) return;
    current.tries += 1;
    if (current.tries >= 3) {
      pending.delete(envelope.id);
      return;
    }
    ws.send(current.payload);
    scheduleRetry(socketId, ws, envelope);
  }, 1000 * (item.tries + 1));
}

export function attachRealtimeWs(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  realtimeBroker.onEmit((envelope) => {
    const raw = JSON.stringify(envelope);
    for (const [socketId, pending] of pendingBySocket.entries()) {
      pending.set(envelope.id, { payload: raw, tries: 0 });
      const socketMeta = realtimeBroker.getSocket(socketId);
      if (!socketMeta) continue;
      scheduleRetry(socketId, socketMeta.ws, envelope);
    }
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", config.baseUrl);
    if (url.pathname !== "/v1/realtime") {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get("token");
    if (!token) {
      socket.destroy();
      return;
    }
    try {
      verifySessionToken(token, config.jwtSecret);
    } catch {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url ?? "", config.baseUrl);
    const token = url.searchParams.get("token");
    if (!token) {
      ws.close();
      return;
    }
    const session = verifySessionToken(token, config.jwtSecret);
    const socketId = createId("sock");
    realtimeBroker.register({
      id: socketId,
      ws,
      partnerId: session.partnerId,
      pingUserId: session.pingUserId,
    });
    pendingBySocket.set(socketId, new Map());

    ws.send(
      JSON.stringify({
        type: "connected",
        socketId,
        pingUserId: session.pingUserId,
      }),
    );

    ws.on("message", (raw) => {
      try {
        const input = JSON.parse(String(raw)) as
          | { type: "subscribe"; channels: ChatChannel[] }
          | { type: "ack"; eventId: string };
        if (input.type === "subscribe") {
          realtimeBroker.setChannels(socketId, input.channels);
          ws.send(JSON.stringify({ type: "subscribed", channels: input.channels }));
        }
        if (input.type === "ack") {
          const pending = pendingBySocket.get(socketId);
          const event = pending?.get(input.eventId);
          if (event?.timer) clearTimeout(event.timer);
          pending?.delete(input.eventId);
          ws.send(JSON.stringify({ type: "acknowledged", eventId: input.eventId }));
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid WS payload" }));
      }
    });

    ws.on("close", () => {
      const pending = pendingBySocket.get(socketId);
      if (pending) {
        for (const item of pending.values()) {
          if (item.timer) clearTimeout(item.timer);
        }
      }
      pendingBySocket.delete(socketId);
      realtimeBroker.unregister(socketId);
    });
  });
}
