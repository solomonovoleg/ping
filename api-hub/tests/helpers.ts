import http from "node:http";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { closeBridgeIdemRedis } from "../src/infra/bridge-idem-redis.js";
import { attachRealtimeWs } from "../src/realtime/ws-server.js";
import { webhookService } from "../src/webhooks/webhook-service.js";

export async function startTestServer() {
  const app = createApp();
  const server = http.createServer(app);
  attachRealtimeWs(server);
  const interval = webhookService.startWorker();
  server.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      clearInterval(interval);
      await closeBridgeIdemRedis().catch(() => {});
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export async function jsonRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as T;
  return { status: response.status, body };
}
