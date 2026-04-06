import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

export function isS3Configured(): boolean {
  return Boolean(config.s3Bucket && config.s3AccessKey && config.s3SecretKey);
}

function client(): S3Client {
  const ep = config.s3Endpoint.trim();
  const base = {
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
    },
  };
  if (ep) {
    return new S3Client({
      ...base,
      endpoint: ep,
      forcePathStyle: true,
    });
  }
  return new S3Client(base);
}

export async function presignPut(key: string, contentType: string, expiresSec: number): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), cmd, { expiresIn: expiresSec });
}

export async function presignGet(key: string, expiresSec: number): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: config.s3Bucket, Key: key });
  return getSignedUrl(client(), cmd, { expiresIn: expiresSec });
}
