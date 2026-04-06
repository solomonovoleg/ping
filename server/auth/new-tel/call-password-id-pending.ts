/**
 * In-memory сессии для New-Tel call-password-id (клиент звонит на confirmationNumber).
 * Вебхук помечает verified; выдача тикета только после verified.
 */
import { CHALLENGE_TTL_MS } from "./call-password-core";

export type InboundPurpose = "signup" | "password_reset";

export type InboundPendingRow = {
  phone: string;
  phoneDigits: string;
  purpose: InboundPurpose;
  verified: boolean;
  expiresAtMs: number;
};

const byCallId = new Map<string, InboundPendingRow>();

function prune(): void {
  const now = Date.now();
  for (const [id, row] of byCallId) {
    if (row.expiresAtMs <= now) byCallId.delete(id);
  }
}

export function setInboundPending(
  callId: string,
  phone: string,
  phoneDigits: string,
  purpose: InboundPurpose,
): void {
  prune();
  byCallId.set(callId, {
    phone,
    phoneDigits,
    purpose,
    verified: false,
    expiresAtMs: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function getInboundPending(callId: string): InboundPendingRow | undefined {
  prune();
  const row = byCallId.get(callId);
  if (!row) return undefined;
  if (Date.now() > row.expiresAtMs) {
    byCallId.delete(callId);
    return undefined;
  }
  return row;
}

export function deleteInboundPending(callId: string): void {
  byCallId.delete(callId);
}

/** Единый вид для RU: 11 цифр, начинается с 7 (как после normalizePhone + только цифры). */
function toRu11Digits(raw: string): string | null {
  const x = raw.replace(/\D/g, "");
  if (x.length === 11 && x.startsWith("7")) return x;
  if (x.length === 11 && x.startsWith("8")) return `7${x.slice(1)}`;
  if (x.length === 10 && x.startsWith("9")) return `7${x}`;
  return null;
}

/** Вебхук: номер звонящего должен совпасть с тем, что ждём по callId. */
export function tryMarkInboundVerifiedFromWebhook(
  callId: string,
  clientNumberDigits: string,
): { ok: true; purpose: InboundPurpose } | { ok: false; reason: string } {
  prune();
  const row = getInboundPending(callId);
  if (!row) return { ok: false, reason: "no_pending" };
  if (row.verified) return { ok: false, reason: "already_verified" };
  const a = toRu11Digits(row.phoneDigits);
  const b = toRu11Digits(clientNumberDigits);
  if (!a || !b || a !== b) return { ok: false, reason: "phone_mismatch" };
  row.verified = true;
  return { ok: true, purpose: row.purpose };
}

export function clearInboundPendingForTests(): void {
  byCallId.clear();
}
