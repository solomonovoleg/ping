/**
 * Токены для мобильного приложения:
 * - stateless HMAC-подпись (переживает рестарты PM2/деплой),
 * - TTL 30 дней (мобильное приложение: реже вылетает «сессия»; веб-кука сессии независима),
 * - без хранения в памяти процесса.
 */
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней (Bearer в приложении)
const AUTH_TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET ||
  process.env.SESSION_SECRET ||
  "ping-moot-auth-secret-change-in-production";

type TokenPayload = {
  u: string; // userId
  e: number; // expiresAt (unix ms)
};

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
  const payload: TokenPayload = { u: userId, e: Date.now() + TTL_MS };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `pm.${payloadB64}.${signature}`;
}

export function getUserIdByToken(token: string): string | null {
  try {
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
    if (!parsed || typeof parsed.u !== "string" || typeof parsed.e !== "number") return null;
    if (parsed.e < Date.now()) return null;
    return parsed.u;
  } catch {
    return null;
  }
}
