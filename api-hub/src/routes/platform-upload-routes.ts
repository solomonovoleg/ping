import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { partnerAuth } from "../middleware/partner-auth.js";
import { requireSession } from "../middleware/session-auth.js";
import { userRateLimit } from "../middleware/rate-limit.js";
import { HttpError } from "../lib/http-error.js";
import { getPingPlatformPmBearer } from "../platform/ping-platform-session.js";
import { PlatformProxyError, proxyPlatformUploadChatMedia } from "../platform/ping-chats-client.js";

const MAX_BYTES = 500 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

export const platformUploadRoutes = Router();

function mapPlatformErr(e: unknown): never {
  if (e instanceof PlatformProxyError) {
    const st =
      e.status === 401 || e.status === 403 || e.status === 404
        ? e.status
        : e.status >= 500
          ? 502
          : 400;
    throw new HttpError(st, "platform_proxy_error", e.message, e.payload);
  }
  throw e;
}

platformUploadRoutes.post(
  "/platform/chat-media",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(new HttpError(400, "file_too_large", "Файл слишком большой (макс. 500 МБ)"));
          return;
        }
        next(new HttpError(400, "upload_error", err.message));
        return;
      }
      if (err) {
        next(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      next();
    });
  },
  (req, res, next) => {
    void (async () => {
      const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
      if (!pm) {
        throw new HttpError(
          501,
          "platform_upload_requires_pm",
          "Загрузка в чат PING доступна только при сессии с платформой (Bearer pm.*)",
        );
      }
      const f = req.file;
      if (!f?.buffer) {
        throw new HttpError(400, "file_required", "Передайте один файл в поле «file» (multipart/form-data)");
      }
      try {
        const platformBody = await proxyPlatformUploadChatMedia(pm, {
          buffer: f.buffer,
          mimetype: f.mimetype || "application/octet-stream",
          originalname: f.originalname || "upload.bin",
        });
        const extra =
          platformBody && typeof platformBody === "object" && platformBody !== null
            ? (platformBody as Record<string, unknown>)
            : {};
        const origin = config.platformBaseUrl?.trim().replace(/\/$/, "") || undefined;
        res.status(201).json({
          ok: true,
          source: "ping_platform",
          pingPlatformOrigin: origin,
          ...extra,
        });
      } catch (e) {
        mapPlatformErr(e);
      }
    })().catch(next);
  },
);
