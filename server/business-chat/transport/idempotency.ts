import crypto from "crypto";

export function createIdempotencyKey(parts: Array<string | null | undefined>): string {
  const data = parts.map((p) => (p ?? "").trim()).join("|");
  return crypto.createHash("sha256").update(data).digest("hex");
}

function defaultSecretForBusinessSigning(): string {
  const secret =
    process.env.BUSINESS_CHAT_MASTER_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.API_HUB_BRIDGE_SECRET?.trim();
  if (secret && secret.length >= 24) return secret;
  if (process.env.ALLOW_INSECURE_SECRETS === "1") {
    console.warn("[security] webhook signing secret is weak or missing, using insecure dev fallback.");
    return "dev-only-business-chat-secret-change-me";
  }
  throw new Error(
    "[security] BUSINESS_CHAT_MASTER_KEY or SESSION_SECRET must be set and at least 24 chars for webhook signing.",
  );
}

export function signBusinessPayload(payload: string, timestampSec: string, secretOverride?: string): string {
  const secret = secretOverride?.trim() || defaultSecretForBusinessSigning();
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestampSec}.${payload}`)
    .digest("hex");
}

export function verifyBusinessPayloadSignature(
  payload: string,
  timestampSec: string,
  signature: string,
  secretOverride?: string,
): boolean {
  const expected = signBusinessPayload(payload, timestampSec, secretOverride);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function isBusinessTimestampFresh(timestampSecRaw: string, maxSkewSec = 300): boolean {
  const ts = Number.parseInt(String(timestampSecRaw || "").trim(), 10);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - ts) <= maxSkewSec;
}
