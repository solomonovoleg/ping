import crypto from "node:crypto";
import type { SessionTokenPayload } from "../types.js";

function base64UrlEncode(value: Buffer | string): string {
  const source = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return source.toString("base64url");
}

function hmacSign(raw: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(raw).digest("base64url");
}

export function signSessionToken(
  payload: SessionTokenPayload,
  secret: string,
  expiresInSec: number,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = { ...payload, exp };
  const data = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(body))}`;
  const signature = hmacSign(data, secret);
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): SessionTokenPayload {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    throw new Error("Malformed token");
  }
  const data = `${header}.${body}`;
  if (hmacSign(data, secret) !== signature) {
    throw new Error("Invalid token signature");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionTokenPayload & {
    exp: number;
  };
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  const { exp, ...payload } = parsed;
  void exp;
  return payload;
}
