import crypto from "node:crypto";
import { Logger } from "../lib/logger.js";
import type { RealtimeEnvelope } from "../types.js";
import { store } from "../store/in-memory-store.js";
import { getPool } from "../infra/db/pool.js";
import * as repo from "../infra/db/repository.js";

const logger = new Logger("info");

interface WebhookJob {
  id: string;
  partnerId: string;
  event: RealtimeEnvelope;
  tries: number;
  nextTryAt: number;
}

const memoryQueue: WebhookJob[] = [];
const memoryDeadLetter: WebhookJob[] = [];

function signBody(body: string, secret: string, timestamp: number): string {
  const payload = `${timestamp}.${body}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function resolvePartner(partnerId: string) {
  if (getPool()) {
    const fromDb = await repo.findPartnerById(partnerId);
    if (fromDb) {
      store.partners.set(fromDb.id, fromDb);
      return fromDb;
    }
  }
  return store.partners.get(partnerId);
}

export class WebhookService {
  enqueue(partnerId: string, event: RealtimeEnvelope): void {
    if (getPool()) {
      void repo.insertWebhookOutbox(partnerId, event);
      return;
    }
    const partner = store.partners.get(partnerId);
    if (!partner?.webhookUrl || !partner.webhookSecret) return;
    memoryQueue.push({
      id: crypto.randomUUID(),
      partnerId,
      event,
      tries: 0,
      nextTryAt: Date.now(),
    });
  }

  startWorker(): NodeJS.Timeout {
    return setInterval(() => {
      void this.flushMemory();
      void this.flushDatabase();
    }, 1000);
  }

  getDeadLetter(): WebhookJob[] {
    return memoryDeadLetter;
  }

  private async flushMemory(): Promise<void> {
    if (getPool()) return;
    const now = Date.now();
    const available = memoryQueue.filter((job) => job.nextTryAt <= now);
    for (const job of available) {
      const index = memoryQueue.findIndex((item) => item.id === job.id);
      if (index >= 0) memoryQueue.splice(index, 1);
      const partner = await resolvePartner(job.partnerId);
      if (!partner?.webhookUrl || !partner.webhookSecret) continue;

      const body = JSON.stringify(job.event);
      const timestamp = Date.now();
      const signature = signBody(body, partner.webhookSecret, timestamp);
      try {
        const response = await fetch(partner.webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(timestamp),
          },
          body,
        });
        if (!response.ok) {
          throw new Error(`Webhook status ${response.status}`);
        }
      } catch (error) {
        job.tries += 1;
        if (job.tries >= 5) {
          memoryDeadLetter.push(job);
          logger.error("webhook delivery moved to dead-letter", {
            partnerId: job.partnerId,
            error: error instanceof Error ? error.message : "unknown",
          });
          continue;
        }
        job.nextTryAt = Date.now() + job.tries * 1000;
        memoryQueue.push(job);
      }
    }
  }

  private async flushDatabase(): Promise<void> {
    if (!getPool()) return;
    await repo.runWebhookOutboxDelivery(async (row) => {
      const partner = await resolvePartner(row.partner_id);
      if (!partner?.webhookUrl || !partner.webhookSecret) {
        throw new Error("Partner webhook not configured");
      }
      const body = JSON.stringify(row.payload);
      const timestamp = Date.now();
      const signature = signBody(body, partner.webhookSecret, timestamp);
      const response = await fetch(partner.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-signature": signature,
          "x-webhook-timestamp": String(timestamp),
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`Webhook status ${response.status}`);
      }
    });
  }
}

export const webhookService = new WebhookService();
