import "dotenv/config";
import fs from "node:fs/promises";
import http from "node:http";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { attachRealtimeWs } from "./realtime/ws-server.js";
import { closeBridgeIdemRedis } from "./infra/bridge-idem-redis.js";
import { initRedisBridge } from "./realtime/redis-bridge.js";
import { webhookService } from "./webhooks/webhook-service.js";
import { store } from "./store/in-memory-store.js";
import { sweepOauthMemory } from "./providers/oauth-transient-store.js";

const app = createApp();
const server = http.createServer(app);

async function bootstrap(): Promise<void> {
  await initRedisBridge();
  attachRealtimeWs(server);

  const webhookWorker = webhookService.startWorker();
  const oauthSweep = setInterval(() => sweepOauthMemory(), 60 * 1000);
  const mediaRetentionWorker = setInterval(() => {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const deletedPaths = store.cleanupMediaBefore(threshold);
    for (const filePath of deletedPaths) {
      void fs.rm(filePath, { force: true });
    }
  }, 60 * 60 * 1000);

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`api-hub listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    clearInterval(webhookWorker);
    clearInterval(oauthSweep);
    clearInterval(mediaRetentionWorker);
    void closeBridgeIdemRedis().finally(() => {
      server.close(() => process.exit(0));
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
