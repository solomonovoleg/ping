import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";
import type { InsertUser } from "@shared/schema";
import { normalizePhone } from "./phone";

const SALT = Buffer.from("ping-moot-phone-at-rest-v1", "utf8");
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

function getSecretRaw(): string | null {
  const s = process.env.PHONE_AT_REST_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export function isPhoneAtRestEnabled(): boolean {
  return getSecretRaw() != null;
}

function deriveKeys(secret: string): { enc: Buffer; mac: Buffer } {
  const raw = scryptSync(secret, SALT, 64);
  return { enc: raw.subarray(0, KEY_LEN), mac: raw.subarray(KEY_LEN, KEY_LEN * 2) };
}

/** Детерминированный индекс для точного поиска / логина / синхронизации контактов (не обратим без секрета). */
export function phoneLookupHash(normalizedPhone: string): string {
  const secret = getSecretRaw();
  if (!secret) throw new Error("PHONE_AT_REST_SECRET is not configured");
  const { mac } = deriveKeys(secret);
  return createHmac("sha256", mac).update(normalizedPhone, "utf8").digest("hex");
}

export function encryptPhonePlain(normalizedPhone: string): string {
  const secret = getSecretRaw();
  if (!secret) throw new Error("PHONE_AT_REST_SECRET is not configured");
  const { enc } = deriveKeys(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", enc, iv);
  const encBuf = Buffer.concat([cipher.update(normalizedPhone, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encBuf]).toString("base64");
}

export function decryptPhoneCipher(stored: string): string {
  const secret = getSecretRaw();
  if (!secret) throw new Error("PHONE_AT_REST_SECRET is not configured");
  const { enc } = deriveKeys(secret);
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("Invalid phone cipher");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", enc, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function preparePhoneForStorage(normalizedPhone: string): { phoneLookupHash: string; phoneCipher: string } {
  return {
    phoneLookupHash: phoneLookupHash(normalizedPhone),
    phoneCipher: encryptPhonePlain(normalizedPhone),
  };
}

/** Телефон для владельца (выгрузка данных и т.п.): из шифра или устаревшей колонки phone. */
export function resolvePlainPhoneForUserRow(row: {
  phone: string | null;
  phoneCipher?: string | null;
}): string | null {
  if (row.phoneCipher?.trim()) {
    try {
      return decryptPhoneCipher(row.phoneCipher.trim());
    } catch {
      return null;
    }
  }
  const p = row.phone?.trim();
  return p && p.length > 0 ? p : null;
}

export function buildUserInsertWithPhone(
  normalizedPhone: string,
  rest: Omit<InsertUser, "phone" | "phoneLookupHash" | "phoneCipher">,
): InsertUser {
  if (isPhoneAtRestEnabled()) {
    const { phoneLookupHash: h, phoneCipher: c } = preparePhoneForStorage(normalizedPhone);
    return {
      ...rest,
      phone: null,
      phoneLookupHash: h,
      phoneCipher: c,
    };
  }
  return {
    ...rest,
    phone: normalizedPhone,
    phoneLookupHash: null,
    phoneCipher: null,
  };
}

