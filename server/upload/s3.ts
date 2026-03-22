/**
 * S3-совместимая загрузка (Cloud.ru Evolution Object Storage и др.).
 * Включение: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.
 * Чтобы объекты были доступны по URL без авторизации: S3_PUBLIC_ACL=1
 * (если бакет запрещает ACL — настройте политику бакета на публичное чтение).
 */

import { S3Client, PutObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const endpoint = process.env.S3_ENDPOINT?.trim();
const bucket = process.env.S3_BUCKET?.trim();
const accessKey = process.env.S3_ACCESS_KEY?.trim();
const secretKey = process.env.S3_SECRET_KEY?.trim();
const region = process.env.S3_REGION?.trim() || "ru-central-1";

export const s3Configured =
  Boolean(endpoint && bucket && accessKey && secretKey);

function getClient(): S3Client {
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3: заданы не все переменные S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
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
    })
  );

  // Path-style URL для Cloud.ru: https://s3.cloud.ru/bucket/key
  const base = endpoint!.replace(/\/$/, "");
  return `${base}/${bucket}/${key}`;
}

export async function uploadToS3(
  keyPrefix: string,
  buffer: Buffer,
  contentType: string,
  extension = ""
): Promise<string> {
  const key = `${keyPrefix}/${randomUUID()}${extension}`;
  return uploadToS3WithKey(key, buffer, contentType);
}
