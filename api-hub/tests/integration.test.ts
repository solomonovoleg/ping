import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, jsonRequest } from "./helpers.js";

const partnerHeaders = {
  "x-partner-api-key": "partner_demo_key",
  "content-type": "application/json",
};

test("oauth -> profile -> chat send/read flow", async () => {
  const server = await startTestServer();
  try {
    const start = await jsonRequest<{ code: string }>(server.baseUrl, "/v1/auth/ping/start", {
      method: "GET",
      headers: partnerHeaders,
    });
    assert.equal(start.status, 200);

    const callback = await jsonRequest<{ accessToken: string }>(
      server.baseUrl,
      `/v1/auth/ping/callback?code=${encodeURIComponent(start.body.code)}`,
      {
        method: "GET",
        headers: partnerHeaders,
      },
    );
    assert.equal(callback.status, 200);
    const accessToken = callback.body.accessToken;
    assert.ok(accessToken.length > 10);

    const me = await jsonRequest<{ profile: { pingUserId: string } }>(server.baseUrl, "/v1/me", {
      method: "GET",
      headers: {
        ...partnerHeaders,
        authorization: `Bearer ${accessToken}`,
      },
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.profile.pingUserId, "ping_u_alex");

    const send = await jsonRequest<{ message: { id: string } }>(
      server.baseUrl,
      "/v1/chats/chat_demo_1/messages:send",
      {
        method: "POST",
        headers: {
          ...partnerHeaders,
          authorization: `Bearer ${accessToken}`,
          "idempotency-key": "itest-msg-1",
        },
        body: JSON.stringify({ kind: "text", text: "hello" }),
      },
    );
    assert.equal(send.status, 201);
    assert.ok(send.body.message.id.startsWith("msg_"));

    const status = await jsonRequest<{ ok: boolean }>(
      server.baseUrl,
      `/v1/messages/${send.body.message.id}/status`,
      {
        method: "POST",
        headers: {
          ...partnerHeaders,
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: "read" }),
      },
    );
    assert.equal(status.status, 200);
    assert.equal(status.body.ok, true);
  } finally {
    await server.close();
  }
});
