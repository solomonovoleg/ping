import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { startTestServer, jsonRequest } from "./helpers.js";

const partnerHeaders = {
  "x-partner-api-key": "partner_demo_key",
  "content-type": "application/json",
};

test("realtime receives burst of events", async () => {
  const server = await startTestServer();
  try {
    const start = await jsonRequest<{ code: string }>(server.baseUrl, "/v1/auth/ping/start", {
      method: "GET",
      headers: partnerHeaders,
    });
    const callback = await jsonRequest<{ accessToken: string }>(
      server.baseUrl,
      `/v1/auth/ping/callback?code=${encodeURIComponent(start.body.code)}`,
      { method: "GET", headers: partnerHeaders },
    );
    const accessToken = callback.body.accessToken;
    const rtToken = await jsonRequest<{ token: string }>(server.baseUrl, "/v1/realtime/token", {
      method: "GET",
      headers: {
        ...partnerHeaders,
        authorization: `Bearer ${accessToken}`,
      },
    });
    const wsUrl = server.baseUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/v1/realtime?token=${encodeURIComponent(rtToken.body.token)}`);
    const seenEvents = new Set<string>();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("ws open timeout")), 3000);
      ws.on("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on("error", reject);
    });

    ws.on("message", (raw) => {
      const payload = JSON.parse(String(raw)) as { id?: string };
      if (payload.id) {
        seenEvents.add(payload.id);
        ws.send(JSON.stringify({ type: "ack", eventId: payload.id }));
      }
    });

    for (let i = 0; i < 20; i += 1) {
      await jsonRequest(server.baseUrl, "/v1/chats/chat_demo_1/messages:send", {
        method: "POST",
        headers: {
          ...partnerHeaders,
          authorization: `Bearer ${accessToken}`,
          "idempotency-key": `load-${i}`,
        },
        body: JSON.stringify({ kind: "text", text: `load-${i}` }),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    ws.close();
    assert.ok(seenEvents.size >= 10);
  } finally {
    await server.close();
  }
});
