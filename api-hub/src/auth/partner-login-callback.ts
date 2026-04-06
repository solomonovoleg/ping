import crypto from "node:crypto";
import { HttpError } from "../lib/http-error.js";

type DeliverPartnerLoginArgs = {
  url: string;
  senderId: string;
  apiKey: string;
};

type CallbackResult = {
  ok: true;
  attempts: number;
  idempotencyKey: string;
};

function signBody(rawBody: string, timestampSec: string, apiKey: string): string {
  return crypto.createHmac("sha256", apiKey).update(`${timestampSec}.${rawBody}`).digest("hex");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delivers server-to-server login callback to partner CRM:
 * POST { senderId } with X-Business-* HMAC headers.
 */
export async function deliverPartnerLoginCallback(input: DeliverPartnerLoginArgs): Promise<CallbackResult> {
  const idempotencyKey = crypto.randomUUID();
  const payload = { senderId: input.senderId, idempotencyKey };
  const rawBody = JSON.stringify(payload);
  const retries = [0, 250, 800];
  const timeoutMs = 12_000;
  let lastStatus = 0;
  let lastBody = "";
  let lastError = "";

  for (let idx = 0; idx < retries.length; idx += 1) {
    if (retries[idx] > 0) {
      await delay(retries[idx]);
    }

    try {
      const ts = String(Math.floor(Date.now() / 1000));
      const signature = signBody(rawBody, ts, input.apiKey);
      const abort = new AbortController();
      const timeoutId = setTimeout(() => abort.abort(), timeoutMs);
      const res = await fetch(input.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
          "X-Business-Timestamp": ts,
          "X-Business-Signature": signature,
        },
        body: rawBody,
        signal: abort.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        return { ok: true, attempts: idx + 1, idempotencyKey };
      }

      lastStatus = res.status;
      lastBody = await res.text().catch(() => "");

      // 4xx: do not retry, this is a business/contract rejection.
      if (res.status >= 400 && res.status < 500) {
        if (res.status === 403) {
          throw new HttpError(403, "crm_sso_forbidden", "CRM rejected senderId for SSO", {
            callbackStatus: res.status,
            callbackBody: lastBody,
            idempotencyKey,
          });
        }
        throw new HttpError(400, "crm_sso_callback_rejected", "CRM rejected SSO callback", {
          callbackStatus: res.status,
          callbackBody: lastBody,
          idempotencyKey,
        });
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      lastError = error instanceof Error ? error.message : "unknown_error";
    }
  }

  throw new HttpError(502, "crm_sso_callback_failed", "CRM login callback failed after retries", {
    callbackStatus: lastStatus,
    callbackBody: lastBody,
    callbackError: lastError,
    timeoutMs,
    idempotencyKey,
  });
}
