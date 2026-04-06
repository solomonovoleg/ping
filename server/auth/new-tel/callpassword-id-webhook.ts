import type { Request, Response } from "express";
import { normalizeDigitsPhone } from "./call-password-core";
import { tryMarkInboundVerifiedFromWebhook } from "./call-password-id-pending";

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Собираем плоские поля из типичных вложений New-Tel. */
function flattenWebhookBody(body: unknown): Record<string, unknown> {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data) ?? {};
  const details =
    asRecord(data.callDetails) ?? asRecord(root.callDetails) ?? asRecord(data.callDetail) ?? {};
  return { ...root, ...data, ...details };
}

const MODE_OK = new Set([
  "",
  "busy",
  "answer",
  "answered",
  "callanswered",
  "success",
  "completed",
  "complete",
]);

const MODE_REJECT = new Set(["failed", "error", "rejected", "cancel", "cancelled", "canceled"]);

export function handleNewTelCallPasswordIdWebhook(req: Request, res: Response): void {
  const flat = flattenWebhookBody(req.body);
  const mode = String(flat.mode ?? flat.event ?? flat.callState ?? "").toLowerCase().trim();
  const callId = pickString(flat, ["callId", "call_id", "id", "sessionId", "session_id"]);
  const clientRaw = pickString(flat, [
    "clientNumber",
    "client_number",
    "callerId",
    "caller_id",
    "ani",
    "srcNumber",
    "src_number",
    "phone",
    "msisdn",
  ]);
  const clientDigits = clientRaw ? normalizeDigitsPhone(clientRaw) : "";

  if (mode && MODE_REJECT.has(mode)) {
    res.status(200).json({ ok: true, ignored: true, reason: "negative_mode" });
    return;
  }
  if (mode && !MODE_OK.has(mode)) {
    res.status(200).json({ ok: true, ignored: true, reason: "mode" });
    return;
  }
  if (!callId || !clientDigits) {
    res.status(200).json({ ok: true, ignored: true, reason: "missing_fields" });
    return;
  }

  const result = tryMarkInboundVerifiedFromWebhook(callId, clientDigits);
  if (!result.ok) {
    res.status(200).json({ ok: true, matched: false, reason: result.reason });
    return;
  }
  res.status(200).json({ ok: true, matched: true, purpose: result.purpose });
}
