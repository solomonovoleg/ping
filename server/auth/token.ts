/**
 * Токены для мобильного приложения:
 * - stateless HMAC-подпись (переживает рестарты PM2/деплой),
 * - TTL 30 дней (мобильное приложение: реже вылетает «сессия»; веб-кука сессии независима),
 * - без хранения в памяти процесса.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней (Bearer в приложении)
function resolveAuthTokenSecret(): string {
  const candidate = process.env.AUTH_TOKEN_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (candidate && candidate.length >= 24) return candidate;
  if (process.env.ALLOW_INSECURE_SECRETS === "1") {
    console.warn("[security] AUTH_TOKEN_SECRET/SESSION_SECRET is weak or missing, using insecure dev fallback.");
    return "dev-insecure-auth-token-secret-change-me";
  }
  throw new Error(
    "[security] AUTH_TOKEN_SECRET (or SESSION_SECRET) must be set and at least 24 chars. " +
      "Set ALLOW_INSECURE_SECRETS=1 only for local development.",
  );
}
const AUTH_TOKEN_SECRET = resolveAuthTokenSecret();

type TokenPayload = {
  u: string; // userId
  e: number; // expiresAt (unix ms)
  i: number; // issuedAt (unix ms)
  j: string; // token id
};

const revokedTokenIds = new Map<string, number>(); // tokenId -> expiresAt
const revokedUserIssuedBefore = new Map<string, number>(); // userId -> issuedAt cutoff

function pruneRevocations(): void {
  const now = Date.now();
  for (const [tokenId, expiresAt] of revokedTokenIds.entries()) {
    if (expiresAt <= now) revokedTokenIds.delete(tokenId);
  }
}

function toBase64Url(input: Buffer | string): string {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(payloadB64: string): string {
  return toBase64Url(createHmac("sha256", AUTH_TOKEN_SECRET).update(payloadB64).digest());
}

export function createToken(userId: string): string {
  const now = Date.now();
  const payload: TokenPayload = {
    u: userId,
    e: now + TTL_MS,
    i: now,
    j: randomBytes(8).toString("hex"),
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `pm.${payloadB64}.${signature}`;
}

export function getUserIdByToken(token: string): string | null {
  try {
    pruneRevocations();
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "pm") return null;
    const payloadB64 = parts[1];
    const signature = parts[2];
    const expectedSignature = sign(payloadB64);
    const signatureBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    if (signatureBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(signatureBuf, expectedBuf)) return null;

    const parsed = JSON.parse(fromBase64Url(payloadB64).toString("utf8")) as Partial<TokenPayload>;
    if (
      !parsed ||
      typeof parsed.u !== "string" ||
      typeof parsed.e !== "number" ||
      typeof parsed.i !== "number" ||
      typeof parsed.j !== "string"
    ) {
      return null;
    }
    if (parsed.e < Date.now()) return null;
    if (revokedTokenIds.has(parsed.j)) return null;
    const revokedBefore = revokedUserIssuedBefore.get(parsed.u);
    if (typeof revokedBefore === "number" && parsed.i <= revokedBefore) return null;
    return parsed.u;
  } catch {
    return null;
  }
}

export function revokeBearerToken(token: string): void {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "pm") return;
    const payload = JSON.parse(fromBase64Url(parts[1]).toString("utf8")) as Partial<TokenPayload>;
    if (
      !payload ||
      typeof payload.j !== "string" ||
      typeof payload.e !== "number" ||
      payload.j.length === 0
    ) {
      return;
    }
    revokedTokenIds.set(payload.j, payload.e);
  } catch {
    // ignore malformed tokens
  }
}

export function revokeAllUserBearerTokens(userId: string): void {
  revokedUserIssuedBefore.set(userId, Date.now());
}
