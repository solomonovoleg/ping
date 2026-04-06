/**
 * S3-совместимая загрузка (Cloud.ru Evolution Object Storage и др.).
 * Включение: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.
 * Чтобы объекты были доступны по URL без авторизации: S3_PUBLIC_ACL=1
 * (если бакет запрещает ACL — настройте политику бакета на публичное чтение).
 *
 * Reg.ru (s3.regru.cloud): Minio-js на длинных PUT часто даёт ECONNRESET — по умолчанию PutObject через AWS SDK
 * с keep-alive агентом; Minio только как fallback при InvalidArgument. Принудительно Minio на Reg.ru: S3_REGRU_MINIO_PUT=1.
 * Другие endpoint: как раньше — minio по умолчанию для совместимости. S3_USE_MINIO_CLIENT=1 | 0.
 *
 * Надёжность: кэш клиентов, maxAttempts у SDK, повторы PutObject при сетевых/503,
 * при ошибке «несовместимости» SDK — один проход через Minio (если не отключено).
 * S3_PUT_MAX_RETRIES (по умолчанию 4), S3_PUT_RETRY_BASE_MS (по умолчанию 300).
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import * as Minio from "minio";
import https from "node:https";
import { randomUUID } from "crypto";
import { normalizeS3AccessKeyId } from "../../shared/s3-access-key";

const endpoint = process.env.S3_ENDPOINT?.trim();
const bucket = process.env.S3_BUCKET?.trim();
const accessKey = normalizeS3AccessKeyId(process.env.S3_ACCESS_KEY);
const secretKey = process.env.S3_SECRET_KEY?.trim();
const region =
  process.env.S3_REGION?.trim() ||
  (endpoint && /s3\.timeweb\.(com|cloud)|\.s3\.msk\.timeweb\.ru/i.test(endpoint) ? "ru-1" : "ru-central-1");

export const s3Configured = Boolean(endpoint && bucket && accessKey && secretKey);

const PUT_MAX_RETRIES = Math.min(
  8,
  Math.max(1, Number.parseInt(process.env.S3_PUT_MAX_RETRIES?.trim() || "4", 10) || 4),
);
const PUT_RETRY_BASE_MS = Math.min(
  8000,
  Math.max(80, Number.parseInt(process.env.S3_PUT_RETRY_BASE_MS?.trim() || "300", 10) || 300),
);

/** Endpoint’ы, где Minio-клиент по умолчанию стабильнее AWS SDK (кроме Reg.ru — см. useMinioClientForPut). */
const MINIO_DEFAULT_HOST_RE =
  /regru\.cloud|s3\.cloud\.ru|storage\.yandexcloud\.net|hb\.bizmrg\.com|selcdn\.ru|s3\.timeweb\.(com|cloud)|\.s3\.msk\.timeweb\.ru/i;

const REGRU_S3_HOST_RE = /regru\.cloud/i;

function isRegruEndpoint(): boolean {
  return Boolean(endpoint && REGRU_S3_HOST_RE.test(endpoint));
}

/** Общий HTTPS-агент: keep-alive снижает ECONNRESET при сериях PutObject к S3-совместимым API. */
let s3HttpsAgent: https.Agent | null = null;
function getS3HttpsAgent(): https.Agent {
  if (!s3HttpsAgent) {
    s3HttpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30_000,
      maxSockets: 64,
      timeout: 120_000,
    });
  }
  return s3HttpsAgent;
}

/**
 * S3_PUBLIC_ACL=1 → пробуем выставить public-read на объект (браузер может грузить превью по прямому URL).
 * Reg.ru: с корректным access key (часть после `/` в паре tenant/key) ACL принимается; без ACL объекты приватные → 403.
 * S3_FORCE_OBJECT_ACL=0 — не слать ACL даже при S3_PUBLIC_ACL=1 (только политика бакета).
 */
function shouldSendObjectAclHeader(): boolean {
  const pub = process.env.S3_PUBLIC_ACL === "1" || process.env.S3_PUBLIC_ACL === "true";
  if (!pub) return false;
  if (process.env.S3_FORCE_OBJECT_ACL?.trim() === "0" || process.env.S3_FORCE_OBJECT_ACL?.trim() === "false") return false;
  if (process.env.S3_FORCE_OBJECT_ACL?.trim() === "1" || process.env.S3_FORCE_OBJECT_ACL?.trim() === "true") return true;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatus(err: unknown): number {
  const m = err as { $metadata?: { httpStatusCode?: number } } | null;
  return typeof m?.$metadata?.httpStatusCode === "number" ? m.$metadata.httpStatusCode : 0;
}

function errSummary(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { name?: string; message?: string; code?: string };
  const st = httpStatus(err);
  return [e.name, e.code, st ? String(st) : "", e.message?.slice(0, 200)].filter(Boolean).join(" · ");
}

function isRetriablePutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  const code = typeof e.code === "string" ? e.code.toUpperCase() : "";
  const name = typeof e.name === "string" ? e.name : "";
  const msg = (e.message != null ? String(e.message) : "").toLowerCase();
  const status = httpStatus(err);

  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE" || code === "ECONNABORTED") return true;
  if (
    /socket hang up|econnreset|etimedout|connection reset|network|timed out|timeout|temporar|try again|slow down|throttl|busy|overload/i.test(
      msg,
    )
  ) {
    return true;
  }
  if (name === "TimeoutError" || name === "NetworkingError") return true;
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;
  if (
    name === "SlowDown" ||
    name === "RequestTimeout" ||
    name === "ServiceUnavailable" ||
    name === "InternalError" ||
    name === "ECOMMUNICATION"
  ) {
    return true;
  }
  if (name === "UnknownError" && status >= 500) return true;
  return false;
}

/** Ошибки, при которых имеет смысл повторить через Minio (тот же ключ, тот же буфер). */
function sdkErrorSuggestsMinioFallback(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; Code?: string; code?: string };
  const name = `${e.name ?? ""}`;
  const msg = `${e.message ?? ""}`.toLowerCase();
  const xmlCode = `${e.Code ?? e.code ?? ""}`;
  const status = httpStatus(err);
  if (/InvalidArgument|InvalidRequest|BadDigest|XAmzContentSHA256|Mismatch/i.test(name)) return true;
  if (/invalidargument|invalidrequest|malformedxml|notimplemented/i.test(xmlCode)) return true;
  if (/checksum|x-amz-checksum|bad digest|invalidargument|incompatible/i.test(msg)) return true;
  if (name === "UnknownError" && (status === 400 || status === 403 || status === 0)) return true;
  // Reg.ru / часть S3-compat отвечают 400 без привычного name — всё равно пробуем Minio
  if (isRegruEndpoint() && status === 400) return true;
  return false;
}

export function useMinioClientForPut(): boolean {
  const flag = process.env.S3_USE_MINIO_CLIENT?.trim();
  if (flag === "0" || flag === "false") return false;
  if (isRegruEndpoint()) {
    const forceMinio = process.env.S3_REGRU_MINIO_PUT?.trim();
    if (forceMinio === "1" || forceMinio === "true") return true;
    return false;
  }
  if (flag === "1" || flag === "true") return true;
  return Boolean(endpoint && MINIO_DEFAULT_HOST_RE.test(endpoint));
}

let cachedS3Client: S3Client | null = null;
let cachedMinio: Minio.Client | null = null;
/** Запасной Minio без keep-alive — иногда обходит ECONNRESET на Reg.ru при длинном теле. */
let cachedMinioNoKeepAlive: Minio.Client | null = null;

/** Для presigned GetObject (`s3-presign-media-urls.ts`). */
export function getS3ClientForPresign(): S3Client {
  return getS3Client();
}

function getS3Client(): S3Client {
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3: заданы не все переменные S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
  }
  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
      maxAttempts: Math.max(PUT_MAX_RETRIES, 3),
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      requestHandler: new NodeHttpHandler({
        httpsAgent: getS3HttpsAgent(),
        connectionTimeout: 30_000,
        socketTimeout: 120_000,
      }),
    });
  }
  return cachedS3Client;
}

/** Для админ-отчёта диска: один HeadBucket, только при OPS_DISK_S3_HEAD_BUCKET=1. */
export async function probeS3BucketHead(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!s3Configured || !bucket) {
    return { ok: false, error: "S3 не настроен (нужны S3_ENDPOINT, S3_BUCKET, ключи)" };
  }
  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function createMinioClient(opts: { keepAlive: boolean }): Minio.Client {
  const parsed = endpoint!.startsWith("http") ? new URL(endpoint!) : new URL(`https://${endpoint!}`);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  const pathStyle = process.env.S3_MINIO_PATH_STYLE === "0" || process.env.S3_MINIO_PATH_STYLE === "false";
  const transportAgent = opts.keepAlive
    ? getS3HttpsAgent()
    : new https.Agent({ keepAlive: false, maxSockets: 32, timeout: 120_000 });
  return new Minio.Client({
    endPoint: parsed.hostname,
    port,
    useSSL: parsed.protocol === "https:",
    accessKey: accessKey!,
    secretKey: secretKey!,
    region,
    pathStyle: !pathStyle,
    transportAgent,
  });
}

function getMinioClient(): Minio.Client {
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3: заданы не все переменные S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
  }
  if (!cachedMinio) {
    cachedMinio = createMinioClient({ keepAlive: true });
  }
  return cachedMinio;
}

function getMinioClientNoKeepAlive(): Minio.Client {
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3: заданы не все переменные S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
  }
  if (!cachedMinioNoKeepAlive) {
    cachedMinioNoKeepAlive = createMinioClient({ keepAlive: false });
  }
  return cachedMinioNoKeepAlive;
}

async function runPutWithRetries(label: string, run: () => Promise<void>): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < PUT_MAX_RETRIES; attempt++) {
    try {
      await run();
      if (attempt > 0) console.info(`[S3] ${label} ok after ${attempt + 1} attempt(s)`);
      return;
    } catch (err) {
      last = err;
      const retriable = isRetriablePutError(err);
      if (!retriable || attempt === PUT_MAX_RETRIES - 1) break;
      const delay = PUT_RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 120);
      console.warn(`[S3] ${label} attempt ${attempt + 1}/${PUT_MAX_RETRIES} failed → retry in ${delay}ms (${errSummary(err)})`);
      await sleep(delay);
    }
  }
  throw last;
}

async function putObjectMinioOnce(
  key: string,
  buffer: Buffer,
  contentType: string,
  allowPublicRead: boolean,
  clientOverride?: Minio.Client,
): Promise<void> {
  const client = clientOverride ?? getMinioClient();
  const safeType = contentType?.trim() || "application/octet-stream";
  const baseMeta: Minio.ItemBucketMetadata = { "Content-Type": safeType };
  try {
    const meta = allowPublicRead ? { ...baseMeta, "x-amz-acl": "public-read" } : baseMeta;
    await client.putObject(bucket!, key, buffer, buffer.length, meta);
  } catch (firstErr) {
    if (allowPublicRead) {
      const allowPrivate =
        process.env.S3_PUT_ALLOW_PRIVATE_WITHOUT_ACL === "1" ||
        process.env.S3_PUT_ALLOW_PRIVATE_WITHOUT_ACL === "true";
      if (allowPrivate) {
        console.warn(
          "[S3/minio] PutObject с ACL не принят — повтор без ACL (S3_PUT_ALLOW_PRIVATE_WITHOUT_ACL=1). Объекты приватные: включите S3_SIGN_MEDIA_GET=1 или политику бакета.",
          firstErr,
        );
        await client.putObject(bucket!, key, buffer, buffer.length, baseMeta);
      } else {
        throw firstErr;
      }
    } else {
      throw firstErr;
    }
  }
}

async function putObjectSdkOnce(
  key: string,
  buffer: Buffer,
  contentType: string,
  allowPublicRead: boolean,
): Promise<void> {
  const client = getS3Client();
  const safeType = contentType?.trim() || "application/octet-stream";
  // Часть S3-compat (в т.ч. Reg.ru) отклоняет лишние заголовки — минимальный набор.
  const putInput = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: safeType,
    ...(isRegruEndpoint()
      ? {}
      : { CacheControl: "public, max-age=31536000, immutable" as const }),
  } as const;
  try {
    await client.send(
      new PutObjectCommand({
        ...putInput,
        ...(allowPublicRead && { ACL: ObjectCannedACL.public_read }),
      }),
    );
  } catch (err) {
    if (allowPublicRead) {
      const allowPrivate =
        process.env.S3_PUT_ALLOW_PRIVATE_WITHOUT_ACL === "1" ||
        process.env.S3_PUT_ALLOW_PRIVATE_WITHOUT_ACL === "true";
      if (allowPrivate) {
        console.warn(
          "[S3] PutObject с ACL не принят — повтор без ACL (S3_PUT_ALLOW_PRIVATE_WITHOUT_ACL=1). Объекты приватные: S3_SIGN_MEDIA_GET=1 или политика бакета.",
          err,
        );
        await client.send(new PutObjectCommand({ ...putInput }));
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }
}

/**
 * Загружает буфер в S3 и возвращает публичный URL объекта.
 * URL в формате path-style: https://s3.cloud.ru/bucket-name/key
 */
export async function uploadToS3WithKey(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const allowAclHeader = shouldSendObjectAclHeader();

  const tryMinio = (labelSuffix = "") =>
    runPutWithRetries(`PutObject minio${labelSuffix} key=${key.slice(0, 48)}…`, () =>
      putObjectMinioOnce(key, buffer, contentType, allowAclHeader),
    );

  const tryMinioNoKa = () =>
    runPutWithRetries(`PutObject minio(no-keep-alive) key=${key.slice(0, 48)}…`, () =>
      putObjectMinioOnce(key, buffer, contentType, allowAclHeader, getMinioClientNoKeepAlive()),
    );

  const trySdk = () => runPutWithRetries(`PutObject sdk key=${key.slice(0, 48)}…`, () =>
    putObjectSdkOnce(key, buffer, contentType, allowAclHeader),
  );

  if (useMinioClientForPut()) {
    try {
      await tryMinio();
    } catch (err) {
      if (isRegruEndpoint() && isRetriablePutError(err)) {
        console.warn("[S3] Minio PutObject failed (сеть); повтор без keep-alive.", errSummary(err));
        await tryMinioNoKa();
      } else {
        throw err;
      }
    }
  } else {
    try {
      await trySdk();
    } catch (err) {
      const fallbackDisabled = process.env.S3_SDK_TO_MINIO_FALLBACK === "0" || process.env.S3_SDK_TO_MINIO_FALLBACK === "false";
      if (!fallbackDisabled && sdkErrorSuggestsMinioFallback(err)) {
        console.warn(
          "[S3] SDK PutObject failed with provider-incompatible error; fallback to Minio client.",
          errSummary(err),
        );
        try {
          await tryMinio();
        } catch (minioErr) {
          if (isRegruEndpoint() && isRetriablePutError(minioErr)) {
            console.warn("[S3] Minio fallback: сеть; повтор без keep-alive.", errSummary(minioErr));
            await tryMinioNoKa();
          } else {
            throw minioErr;
          }
        }
      } else {
        throw err;
      }
    }
  }

  const urlBase = endpoint!.replace(/\/$/, "");
  return `${urlBase}/${bucket}/${key}`;
}

export async function uploadToS3(
  keyPrefix: string,
  buffer: Buffer,
  contentType: string,
  extension = "",
): Promise<string> {
  const key = `${keyPrefix}/${randomUUID()}${extension}`;
  return uploadToS3WithKey(key, buffer, contentType);
}

/** HeadObject: бэкфилл постеров, аудит. */
export async function s3ObjectExists(key: string): Promise<boolean> {
  if (!s3Configured || !bucket) return false;
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const st = httpStatus(err);
    if (st === 404) return false;
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number }; Code?: string };
    if (e.name === "NotFound" || e.Code === "NotFound" || e.Code === "NoSuchKey") return false;
    throw err;
  }
}

/** Скачать объект в Buffer (скрипты бэкфилла и т.п.). */
export async function getS3ObjectBuffer(key: string): Promise<Buffer> {
  if (!s3Configured || !bucket) {
    throw new Error("S3 не настроен");
  }
  const res = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`S3 GetObject пустое тело: ${key}`);
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Ключ объекта из публичного URL, который вернул `uploadToS3WithKey`
 * (`{endpoint}/{bucket}/{key}` path-style).
 */
export function parseS3KeyFromPublicUrl(urlStr: string): string | null {
  const b = bucket;
  if (!b) return null;
  try {
    const u = new URL(urlStr);
    const p = u.pathname.replace(/^\/+/, "");
    const pref = `${b}/`;
    if (p.startsWith(pref)) return p.slice(pref.length);
  } catch {
    /* ignore */
  }
  return null;
}
