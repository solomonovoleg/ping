import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";
import { ApiHubClient } from "../sdk/js/src/index.js";

test("sdk covers core auth/chat methods", async () => {
  const server = await startTestServer();
  try {
    const sdk = new ApiHubClient({
      baseUrl: server.baseUrl,
      partnerApiKey: "partner_demo_key",
    });
    const start = await sdk.startOAuth({ pingUserId: "ping_u_alex", externalUserId: "ext_1" });
    const session = await sdk.completeOAuth(start.code);
    sdk.setAccessToken(session.accessToken);
    const me = await sdk.me();
    assert.equal(me.profile.pingUserId, "ping_u_alex");
    const chats = await sdk.chats();
    assert.ok(Array.isArray(chats.chats));
    const firstChat = chats.chats[0];
    const sendResult = await sdk.sendMessage(firstChat.id, {
      kind: "text",
      text: "message via sdk",
    });
    assert.ok(sendResult.message.id.startsWith("msg_"));
  } finally {
    await server.close();
  }
});
