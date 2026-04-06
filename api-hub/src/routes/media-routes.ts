import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { partnerAuth } from "../middleware/partner-auth.js";
import { requireSession } from "../middleware/session-auth.js";
import { userRateLimit } from "../middleware/rate-limit.js";
import { HttpError } from "../lib/http-error.js";
import { scanMediaBufferIfConfigured } from "../lib/media-scan.js";
import { isS3Configured, presignGet, presignPut } from "../infra/s3-presign.js";
import { store } from "../store/in-memory-store.js";

const uploadInitSchema = z.object({
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(60 * 1024 * 1024),
});

const uploadCompleteBase64Schema = z.object({
  mediaId: z.string().min(1),
  fileName: z.string().min(1),
  base64Data: z.string().min(1),
});

const uploadCompleteS3Schema = z.object({
  mediaId: z.string().min(1),
  uploadVia: z.literal("s3"),
});

const uploadCompleteSchema = z.union([uploadCompleteBase64Schema, uploadCompleteS3Schema]);

const mediaMessageSchema = z.object({
  chatId: z.string().min(1),
  kind: z.enum(["voice_note", "video_note"]),
  mediaId: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  waveform: z.array(z.number()).max(256).optional(),
  posterUrl: z.string().optional(),
});

const allowedMime = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/webm",
]);

function signMedia(mediaId: string, expiresAt: number): string {
  const payload = `${mediaId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyMediaToken(token: string): { mediaId: string } {
  const [mediaId, expiresAtRaw, signature] = token.split(".");
  if (!mediaId || !expiresAtRaw || !signature) {
    throw new HttpError(401, "invalid_media_token", "Invalid media token");
  }
  const payload = `${mediaId}.${expiresAtRaw}`;
  const expected = crypto.createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
  if (expected !== signature) {
    throw new HttpError(401, "invalid_media_token", "Invalid media token");
  }
  const expiresAt = Number(expiresAtRaw);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    throw new HttpError(401, "expired_media_token", "Media token expired");
  }
  return { mediaId };
}

async function ensureMediaDir(): Promise<void> {
  await fs.mkdir(config.mediaDir, { recursive: true });
}

export const mediaRoutes = Router();

const PARTNER_MEDIA_QUOTA_BYTES = 1024 * 1024 * 1024;

mediaRoutes.post("/media/upload-init", partnerAuth, requireSession(["chat.write"]), userRateLimit, async (req, res) => {
  const parsed = uploadInitSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_body", "Invalid upload-init payload", parsed.error.flatten());
  }
  if (!allowedMime.has(parsed.data.contentType)) {
    throw new HttpError(400, "unsupported_media_type", "Unsupported content type");
  }
  const usedBytes = store.mediaBytesForPartner(req.sessionAuth!.partnerId);
  if (usedBytes + parsed.data.sizeBytes > PARTNER_MEDIA_QUOTA_BYTES) {
    throw new HttpError(429, "partner_media_quota_exceeded", "Partner media quota exceeded", {
      quotaBytes: PARTNER_MEDIA_QUOTA_BYTES,
      usedBytes,
    });
  }
  const media = store.createMedia({
    partnerId: req.sessionAuth!.partnerId,
    ownerPingUserId: req.sessionAuth!.pingUserId,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
    storagePath: path.join(config.mediaDir, "pending"),
  });

  if (isS3Configured()) {
    const s3Key = `api-hub/${media.id}/upload.bin`;
    media.storagePath = `s3:${s3Key}`;
    const presignedPutUrl = await presignPut(s3Key, parsed.data.contentType, 600);
    res.status(201).json({
      ok: true,
      mediaId: media.id,
      uploadMode: "s3",
      s3Key,
      presignedPutUrl,
      expiresIn: 600,
      maxSizeBytes: 60 * 1024 * 1024,
    });
    return;
  }

  await ensureMediaDir();
  res.status(201).json({
    ok: true,
    mediaId: media.id,
    uploadMode: "base64",
    maxSizeBytes: 60 * 1024 * 1024,
  });
});

mediaRoutes.post(
  "/media/upload-complete",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  async (req, res) => {
    const parsed = uploadCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_body", "Invalid upload-complete payload", parsed.error.flatten());
    }
    const media = store.getMedia(parsed.data.mediaId);
    if (!media) {
      throw new HttpError(404, "media_not_found", "Media not found");
    }

    if ("uploadVia" in parsed.data && parsed.data.uploadVia === "s3") {
      if (!media.storagePath.startsWith("s3:")) {
        throw new HttpError(400, "invalid_media_upload_mode", "Media was not initialized for S3 upload");
      }
      store.markMediaReady(media.id);
      const s3Key = media.storagePath.slice("s3:".length);
      const publicUrl = config.s3PublicBaseUrl.trim()
        ? `${config.s3PublicBaseUrl.replace(/\/$/, "")}/${s3Key}`
        : await presignGet(s3Key, 600);
      res.json({
        ok: true,
        mediaId: media.id,
        url: publicUrl,
        expiresIn: config.s3PublicBaseUrl.trim() ? undefined : 600,
      });
      return;
    }

    const body = parsed.data as { mediaId: string; fileName: string; base64Data: string };
    const fileBuffer = Buffer.from(body.base64Data, "base64");
    if (fileBuffer.byteLength > media.sizeBytes) {
      throw new HttpError(400, "media_size_mismatch", "Uploaded file is larger than declared");
    }
    await scanMediaBufferIfConfigured(fileBuffer, media.contentType);
    await ensureMediaDir();
    const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const target = path.join(config.mediaDir, `${media.id}_${safeName}`);
    await fs.writeFile(target, fileBuffer);
    media.storagePath = target;
    store.markMediaReady(media.id);
    const token = signMedia(media.id, Date.now() + 10 * 60 * 1000);
    res.json({
      ok: true,
      mediaId: media.id,
      url: `${config.baseUrl}/v1/media/file/${media.id}?token=${encodeURIComponent(token)}`,
      expiresIn: 600,
    });
  },
);

mediaRoutes.get("/media/file/:mediaId", async (req, res) => {
  const mediaId = req.params.mediaId;
  const token = req.query.token?.toString() ?? "";
  const parsed = verifyMediaToken(token);
  if (parsed.mediaId !== mediaId) {
    throw new HttpError(401, "invalid_media_token", "Invalid media token");
  }
  const media = store.getMedia(mediaId);
  if (!media || media.status !== "ready") {
    throw new HttpError(404, "media_not_found", "Media not found");
  }
  if (media.storagePath.startsWith("s3:")) {
    const s3Key = media.storagePath.slice("s3:".length);
    const url = await presignGet(s3Key, 300);
    res.redirect(302, url);
    return;
  }
  const body = await fs.readFile(media.storagePath);
  res.setHeader("content-type", media.contentType);
  res.send(body);
});

mediaRoutes.post(
  "/media/messages/send",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  (req, res) => {
    const parsed = mediaMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_body", "Invalid media message payload", parsed.error.flatten());
    }
    const media = store.getMedia(parsed.data.mediaId);
    if (!media || media.status !== "ready") {
      throw new HttpError(404, "media_not_found", "Media not found");
    }
    const token = signMedia(media.id, Date.now() + 10 * 60 * 1000);
    const url = `${config.baseUrl}/v1/media/file/${media.id}?token=${encodeURIComponent(token)}`;
    const message = store.createMessage({
      chatId: parsed.data.chatId,
      senderPingUserId: req.sessionAuth!.pingUserId,
      kind: parsed.data.kind,
      media: {
        mediaId: media.id,
        url,
        durationMs: parsed.data.durationMs,
        waveform: parsed.data.waveform,
        posterUrl: parsed.data.posterUrl,
      },
    });
    res.status(201).json({ ok: true, message });
  },
);
