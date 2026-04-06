/**
 * Presigned GET для объектов в нашем бакете (приватный бакет + ключи только на сервере).
 * В логах продакшена не выводить полный подписанный URL (query содержит подпись).
 * По умолчанию при s3Configured всегда включено. Отключить: S3_SIGN_MEDIA_GET=0 (например, публичная политика бакета).
 * TTL: S3_SIGN_MEDIA_GET_SEC (по умолчанию 604800 = 7 суток).
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3ClientForPresign, s3Configured } from "./s3";

const bucket = () => process.env.S3_BUCKET?.trim() ?? "";

function extractOwnBucketKeyFromUrl(urlString: string): string | null {
  const ep = process.env.S3_ENDPOINT?.trim().replace(/\/$/, "") ?? "";
  const b = bucket();
  if (!ep || !b) return null;
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return null;
  }
  let epUrl: URL;
  try {
    epUrl = ep.startsWith("http") ? new URL(ep) : new URL(`https://${ep}`);
  } catch {
    return null;
  }
  if (u.host !== epUrl.host) return null;
  const prefix = `/${b}/`;
  if (!u.pathname.startsWith(prefix)) return null;
  const key = u.pathname.slice(prefix.length);
  if (!key) return null;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function signMediaGetTtlSec(): number {
  const raw = Number.parseInt(process.env.S3_SIGN_MEDIA_GET_SEC?.trim() || "604800", 10);
  if (!Number.isFinite(raw) || raw < 60) return 604800;
  return Math.min(raw, 604800);
}

/** Подписывать URL для браузера (приватный S3). Только S3_SIGN_MEDIA_GET=0 отключает. */
export function shouldPresignS3MediaGetUrls(): boolean {
  if (!s3Configured) return false;
  const explicit = process.env.S3_SIGN_MEDIA_GET?.trim();
  if (explicit === "0" || explicit === "false") return false;
  return true;
}

/**
 * Если URL указывает на объект в нашем S3-бакете — возвращает presigned URL, иначе null.
 */
export async function presignOwnS3ObjectUrl(url: string): Promise<string | null> {
  if (!s3Configured) return null;
  const b = bucket();
  if (!b) return null;
  const key = extractOwnBucketKeyFromUrl(url);
  if (!key) return null;
  try {
    const client = getS3ClientForPresign();
    const cmd = new GetObjectCommand({ Bucket: b, Key: key });
    return await getSignedUrl(client, cmd, { expiresIn: signMediaGetTtlSec() });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[S3 presign GetObject]", err);
    }
    return null;
  }
}

/** Для полей профиля / сториз: подписать только «наши» S3-URL. */
export async function resolveMediaUrlForClient(url: string | null | undefined): Promise<string | null> {
  if (url == null) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (!shouldPresignS3MediaGetUrls()) return u;
  if (!/^https?:\/\//i.test(u)) return u;
  const signed = await presignOwnS3ObjectUrl(u);
  return signed ?? u;
}
