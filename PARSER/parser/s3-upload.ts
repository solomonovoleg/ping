import { S3Client, PutObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
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

function getClient(): S3Client {
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3: задайте S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
    maxAttempts: 4,
    /** Как на платформе: иначе часть S3-совместимых API (Timeweb и др.) отвечает 400 на checksum-заголовки SDK. */
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

async function uploadToS3WithKey(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getClient();
  const allowPublicRead = process.env.S3_PUBLIC_ACL === "1" || process.env.S3_PUBLIC_ACL === "true";
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ...(allowPublicRead && { ACL: ObjectCannedACL.public_read }),
    }),
  );
  const base = endpoint!.replace(/\/$/, "");
  return `${base}/${bucket}/${key}`;
}

export async function uploadToS3(keyPrefix: string, buffer: Buffer, contentType: string, extension = ""): Promise<string> {
  const key = `${keyPrefix}/${randomUUID()}${extension}`;
  return uploadToS3WithKey(key, buffer, contentType);
}
