import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, jsonRequest } from "./helpers.js";

const BRIDGE = "bridge-itest-secret";

function snapshotEnv(): Record<string, string | undefined> {
  return {
    API_HUB_BRIDGE_SECRET: process.env.API_HUB_BRIDGE_SECRET,
    API_HUB_BRIDGE_ALLOWED_IPS: process.env.API_HUB_BRIDGE_ALLOWED_IPS,
    API_HUB_BRIDGE_TRUST_X_FORWARDED: process.env.API_HUB_BRIDGE_TRUST_X_FORWARDED,
    API_HUB_REDIS_URL: process.env.API_HUB_REDIS_URL,
  };
}

function restoreEnv(s: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function minimalCreatedBody(chatId: string) {
  return {
    event: "message.created" as const,
    chatId,
    memberUserIds: ["ping_u_alex", "ping_u_olga"],
    message: {
      id: "msg_bridge_test",
      chatId,
      senderId: "ping_u_alex",
      type: "text",
      content: "hi",
      createdAt: new Date().toISOString(),
    },
  };
}

test("platform bridge rejects wrong bearer", async () => {
  const snap = snapshotEnv();
  try {
    process.env.API_HUB_BRIDGE_SECRET = BRIDGE;
    delete process.env.API_HUB_BRIDGE_ALLOWED_IPS;
    const server = await startTestServer();
    try {
      const r = await jsonRequest<Record<string, unknown>>(server.baseUrl, "/internal/platform/chat-message", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong",
          "content-type": "application/json",
        },
        body: JSON.stringify(minimalCreatedBody("chat_demo_1")),
      });
      assert.equal(r.status, 401);
    } finally {
      await server.close();
    }
  } finally {
    restoreEnv(snap);
  }
});

test("platform bridge accepts valid body (202)", async () => {
  const snap = snapshotEnv();
  try {
    process.env.API_HUB_BRIDGE_SECRET = BRIDGE;
    delete process.env.API_HUB_BRIDGE_ALLOWED_IPS;
    const server = await startTestServer();
    try {
      const r = await jsonRequest<{ accepted?: boolean; deliveredToSessions?: number }>(
        server.baseUrl,
        "/internal/platform/chat-message",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${BRIDGE}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(minimalCreatedBody("chat_demo_1")),
        },
      );
      assert.equal(r.status, 202);
      assert.equal(r.body.accepted, true);
      assert.equal(typeof r.body.deliveredToSessions, "number");
    } finally {
      await server.close();
    }
  } finally {
    restoreEnv(snap);
  }
});

test("platform bridge Idempotency-Key duplicate (in-memory)", async () => {
  const snap = snapshotEnv();
  try {
    process.env.API_HUB_BRIDGE_SECRET = BRIDGE;
    delete process.env.API_HUB_BRIDGE_ALLOWED_IPS;
    delete process.env.API_HUB_REDIS_URL;
    const server = await startTestServer();
    try {
      const idem = `idem-mem-${Date.now()}`;
      const init = {
        method: "POST" as const,
        headers: {
          authorization: `Bearer ${BRIDGE}`,
          "content-type": "application/json",
          "idempotency-key": idem,
        },
        body: JSON.stringify(minimalCreatedBody("chat_demo_1")),
      };
      const first = await jsonRequest<{ duplicate?: boolean }>(server.baseUrl, "/internal/platform/chat-message", init);
      assert.equal(first.status, 202);
      assert.notEqual(first.body.duplicate, true);
      const second = await jsonRequest<{ duplicate?: boolean }>(server.baseUrl, "/internal/platform/chat-message", init);
      assert.equal(second.status, 202);
      assert.equal(second.body.duplicate, true);
    } finally {
      await server.close();
    }
  } finally {
    restoreEnv(snap);
  }
});

test("platform bridge forbidden when IP not in allowlist", async () => {
  const snap = snapshotEnv();
  try {
    process.env.API_HUB_BRIDGE_SECRET = BRIDGE;
    process.env.API_HUB_BRIDGE_ALLOWED_IPS = "198.51.100.99";
    const server = await startTestServer();
    try {
      const r = await jsonRequest<Record<string, unknown>>(server.baseUrl, "/internal/platform/chat-message", {
        method: "POST",
        headers: {
          authorization: `Bearer ${BRIDGE}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(minimalCreatedBody("chat_demo_1")),
      });
      assert.equal(r.status, 403);
      assert.equal((r.body as { error?: string }).error, "forbidden_ip");
    } finally {
      await server.close();
    }
  } finally {
    restoreEnv(snap);
  }
});

test("platform bridge allowlist allows 127.0.0.1", async () => {
  const snap = snapshotEnv();
  try {
    process.env.API_HUB_BRIDGE_SECRET = BRIDGE;
    process.env.API_HUB_BRIDGE_ALLOWED_IPS = "127.0.0.1";
    const server = await startTestServer();
    try {
      const r = await jsonRequest<{ accepted?: boolean }>(server.baseUrl, "/internal/platform/chat-message", {
        method: "POST",
        headers: {
          authorization: `Bearer ${BRIDGE}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(minimalCreatedBody("chat_demo_1")),
      });
      assert.equal(r.status, 202);
      assert.equal(r.body.accepted, true);
    } finally {
      await server.close();
    }
  } finally {
    restoreEnv(snap);
  }
});

test(
  "platform bridge Redis idempotency duplicate",
  { skip: !process.env.API_HUB_TEST_REDIS_URL?.trim() },
  async () => {
    const snap = snapshotEnv();
    const redisUrl = process.env.API_HUB_TEST_REDIS_URL!.trim();
    try {
      process.env.API_HUB_BRIDGE_SECRET = BRIDGE;
      delete process.env.API_HUB_BRIDGE_ALLOWED_IPS;
      process.env.API_HUB_REDIS_URL = redisUrl;
      const server = await startTestServer();
      try {
        const idem = `idem-redis-${Date.now()}`;
        const init = {
          method: "POST" as const,
          headers: {
            authorization: `Bearer ${BRIDGE}`,
            "content-type": "application/json",
            "idempotency-key": idem,
          },
          body: JSON.stringify(minimalCreatedBody("chat_demo_1")),
        };
        const first = await jsonRequest<{ duplicate?: boolean }>(
          server.baseUrl,
          "/internal/platform/chat-message",
          init,
        );
        assert.equal(first.status, 202);
        assert.notEqual(first.body.duplicate, true);
        const second = await jsonRequest<{ duplicate?: boolean }>(
          server.baseUrl,
          "/internal/platform/chat-message",
          init,
        );
        assert.equal(second.status, 202);
        assert.equal(second.body.duplicate, true);
      } finally {
        await server.close();
      }
    } finally {
      restoreEnv(snap);
    }
  },
);
