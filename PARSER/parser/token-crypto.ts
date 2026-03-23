import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

function deriveKeyFromEnv(): Buffer {
  const raw = process.env.VK_PARSER_TOKEN_KEY?.trim();
  if (!raw) {
    throw new Error(
      "Задайте VK_PARSER_TOKEN_KEY (64 hex = 32 байта, или парольная фраза — scrypt)",
    );
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, "ping-moot:vk-parser:v1", 32);
}

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (!cachedKey) cachedKey = deriveKeyFromEnv();
  return cachedKey;
}

export function encryptVkToken(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decryptVkToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Некорректные данные токена");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const data = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
}
