import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { config } from "../config.js";
import { pingDb, getPool } from "../infra/db/pool.js";
import * as repo from "../infra/db/repository.js";
import { getMetricsSnapshot } from "../middleware/metrics.js";
import { store } from "../store/in-memory-store.js";
import { webhookService } from "../webhooks/webhook-service.js";

const openApiPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../openapi/api-hub.v1.yaml");

export const systemRoutes = Router();

systemRoutes.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api-hub", ts: new Date().toISOString() });
});

systemRoutes.get("/ready", async (_req, res) => {
  const pool = getPool();
  const dbOk = pool ? await pingDb() : true;
  const payload = {
    ok: dbOk,
    env: config.env,
    checks: {
      database: pool ? (dbOk ? "ok" : "unreachable") : "disabled",
    },
    ts: new Date().toISOString(),
  };
  res.status(dbOk ? 200 : 503).json(payload);
});

systemRoutes.get("/openapi.yaml", async (_req, res) => {
  const content = await fs.readFile(openApiPath, "utf8");
  res.setHeader("content-type", "application/yaml");
  res.send(content);
});

systemRoutes.get("/webhooks/dead-letter", (_req, res) => {
  res.json({ ok: true, deadLetter: webhookService.getDeadLetter() });
});

systemRoutes.get("/metrics", async (_req, res) => {
  const base = getMetricsSnapshot();
  let webhookDeadDb = 0;
  try {
    webhookDeadDb = await repo.countWebhookDeadLetter();
  } catch {
    webhookDeadDb = 0;
  }
  res.json({
    ok: true,
    metrics: {
      ...base,
      sessions: store.sessions.size,
      chats: store.chats.size,
      messages: Array.from(store.messages.values()).reduce((acc, list) => acc + list.length, 0),
      deadLetterWebhooks_memory: webhookService.getDeadLetter().length,
      deadLetterWebhooks_db: webhookDeadDb,
      audits: store.auditLog.length,
      auth_mode: config.authMode,
      redis: Boolean(config.redisUrl),
      s3: Boolean(config.s3Bucket && config.s3AccessKey),
    },
  });
});

systemRoutes.get("/metrics/prometheus", async (_req, res) => {
  const m = getMetricsSnapshot();
  let webhookDeadDb = 0;
  try {
    webhookDeadDb = await repo.countWebhookDeadLetter();
  } catch {
    webhookDeadDb = 0;
  }
  const lines = [
    `# HELP api_hub_http_requests_total Total HTTP requests`,
    `# TYPE api_hub_http_requests_total counter`,
    `api_hub_http_requests_total ${m.http_requests_total}`,
    `# HELP api_hub_http_errors_5xx_total Total 5xx responses`,
    `# TYPE api_hub_http_errors_5xx_total counter`,
    `api_hub_http_errors_5xx_total ${m.http_errors_5xx_total}`,
    `# HELP api_hub_realtime_events_total Realtime events emitted`,
    `# TYPE api_hub_realtime_events_total counter`,
    `api_hub_realtime_events_total ${m.realtime_events_total}`,
    `# HELP api_hub_bridge_requests_total Platform bridge POST attempts`,
    `# TYPE api_hub_bridge_requests_total counter`,
    `api_hub_bridge_requests_total ${m.bridge_requests_total}`,
    `# HELP api_hub_bridge_accepted_202_total Bridge requests accepted (202)`,
    `# TYPE api_hub_bridge_accepted_202_total counter`,
    `api_hub_bridge_accepted_202_total ${m.bridge_accepted_202_total}`,
    `# HELP api_hub_bridge_events_emitted_total Events emitted from bridge (sum of targets)`,
    `# TYPE api_hub_bridge_events_emitted_total counter`,
    `api_hub_bridge_events_emitted_total ${m.bridge_events_emitted_total}`,
    `# HELP api_hub_bridge_auth_401_total Bridge unauthorized`,
    `# TYPE api_hub_bridge_auth_401_total counter`,
    `api_hub_bridge_auth_401_total ${m.bridge_auth_401_total}`,
    `# HELP api_hub_bridge_forbidden_ip_403_total Bridge IP not in allowlist`,
    `# TYPE api_hub_bridge_forbidden_ip_403_total counter`,
    `api_hub_bridge_forbidden_ip_403_total ${m.bridge_forbidden_ip_403_total}`,
    `# HELP api_hub_bridge_validation_400_total Bridge bad body`,
    `# TYPE api_hub_bridge_validation_400_total counter`,
    `api_hub_bridge_validation_400_total ${m.bridge_validation_400_total}`,
    `# HELP api_hub_bridge_idempotent_duplicates_total Bridge duplicate Idempotency-Key`,
    `# TYPE api_hub_bridge_idempotent_duplicates_total counter`,
    `api_hub_bridge_idempotent_duplicates_total ${m.bridge_idempotent_duplicates_total}`,
    `# HELP api_hub_webhook_dead_letter_db Webhook jobs dead in DB`,
    `# TYPE api_hub_webhook_dead_letter_db gauge`,
    `api_hub_webhook_dead_letter_db ${webhookDeadDb}`,
  ];
  res.setHeader("content-type", "text/plain; version=0.0.4");
  res.send(lines.join("\n") + "\n");
});
