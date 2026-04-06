import path from "path";
import fs from "fs";
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import express from "express";
import { setupSession, ensureSessionTable } from "./auth/session";
import { registerAuthRoutes } from "./auth/routes";
import { registerAdminRoutes } from "./admin/routes";
import { registerReferralRoutes } from "./referrals/routes";
import { registerChatsRoutes } from "./chats/routes";
import { registerMessagesRoutes } from "./messages/routes";
import { registerCommentsRoutes } from "./features/comments/register-comments-routes";
import { registerPostsRoutes } from "./posts/routes";
import { registerReactionsRoutes } from "./reactions/routes";
import { registerStoriesRoutes } from "./stories/routes";
import { registerNotificationsRoutes } from "./notifications/routes";
import { registerPushFeedRoutes } from "./push-feed/routes";
import { registerUsersRoutes } from "./users/routes";
import { registerVoiceUploadRoutes } from "./upload/voice";
import { registerPostMediaUploadRoutes } from "./upload/post-media";
import { registerStoryMediaUploadRoutes } from "./upload/story-media";
import { registerChatMediaUploadRoutes } from "./upload/chat-media";
import { registerStickerPackRoutes, STICKER_UPLOAD_SUBDIR } from "./stickers";
import { registerAvatarUploadRoutes } from "./upload/avatar";
import { registerCoverUploadRoutes } from "./upload/cover";
import { registerCallRoutes } from "./calls/routes";
import { attachCallWebSocket } from "./calls/ws";
import { startAdminMetricsCollector } from "./admin/metrics-collector";
import { attachGroupCallTransport, registerGroupCallRoutes } from "./group-calls";
import { registerSavedMessagesRoutes } from "./saved-messages/routes";
import { registerTracksRoutes } from "./tracks/routes";
import { registerAiChatRoutes } from "./ai-chat/routes";
import { registerAiSearchRoutes } from "./ai-search";
import { registerSpellcheckRoutes } from "./spellcheck/routes";
import { registerLinkPreviewRoutes } from "./link-preview/routes";
import { registerTranslateRoutes } from "./translate/routes";
import { registerVibeRoutes } from "./vibe/routes";
import { registerCallTranscriptRoutes } from "./call-transcripts/routes";
import { registerClientTelemetryRoutes } from "./telemetry/client-events.routes";
import {
  ensureUserColumns,
  ensureChatVibeSchema,
  ensureCallTranscriptsSchema,
  ensurePostsFeedSchema,
  ensureChatCodesSchema,
  ensureContentReportsSchema,
} from "./db";
import { registerOpsPlatformPublicRoute } from "./admin/ops/platform.public-http";
import { registerOpsUserReportsRoute } from "./admin/ops/reports.user-http";
import { registerGeoRoutes } from "./geo/routes";
import { registerProfilePinsRoutes } from "./profile-pins/routes";
import { registerHelpPagesRoutes } from "./help-pages/routes";
import { registerPingokMicroRoutes } from "./pingok-micro/routes";
import { registerRemindersRoutes } from "./reminders/routes";
import { registerServiceChatRoutes } from "./service-chat/routes";
import { registerBusinessChatRoutes } from "./business-chat/routes";
import { registerEdgeRoutes } from "./edge/routes";
import { registerSenderRoutes } from "./sender/routes";
import { registerInternalParserPublishRoutes } from "./internal/parser-publish";
import { registerInternalApiHubIssueBearerRoutes } from "./internal/api-hub-issue-bearer";
import { apiTrafficRecordMiddleware } from "./middleware/api-shield";
import { apiTrafficModuleTelemetryMiddleware } from "./admin/telemetry";
import { csrfProtectionMiddleware } from "./middleware/security/csrf-protection-middleware";
import { setupAbuseGuard } from "./middleware/security/abuse-guard-middleware";
import { verifySignedUploadPathAny } from "./security/upload-access-signature";
import { logSecurityAuditEvent } from "./security/security-audit-log";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const UPLOADS_SUBDIRS = ["voice", "posts", "stories", "avatars", "covers", "chat", STICKER_UPLOAD_SUBDIR];
const LEGACY_UPLOAD_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".heic",
  ".heif",
];
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".aac", ".ogg", ".m4a", ".opus"]);
const TRANSPARENT_GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

function ensureUploadsDirs(): void {
  if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  for (const sub of UPLOADS_SUBDIRS) {
    const dir = path.join(UPLOADS_ROOT, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveLegacyUploadName(bucket: string, requestedName: string): string | null {
  const safeBucket = path.basename(bucket);
  const safeRequested = path.basename(requestedName);
  if (!safeBucket || !safeRequested) return null;
  if (safeBucket !== bucket || safeRequested !== requestedName) return null;
  if (!UPLOADS_SUBDIRS.includes(safeBucket)) return null;

  const parsed = path.parse(safeRequested);
  const stem = (parsed.name || parsed.base || "").trim();
  if (!stem) return null;

  const bucketDir = path.join(UPLOADS_ROOT, safeBucket);
  for (const ext of LEGACY_UPLOAD_EXTENSIONS) {
    const candidateName = `${stem}${ext}`;
    const candidatePath = path.join(bucketDir, candidateName);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidateName;
    }
  }
  return null;
}

function sendMissingUploadPlaceholder(res: Response, requestedName: string): void {
  const ext = path.extname(requestedName).toLowerCase();
  res.setHeader("Cache-Control", "public, max-age=300");
  if (VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext)) {
    // Avoid 404 noise for old media links; client will handle empty media as unavailable.
    res.status(204).end();
    return;
  }
  // For unknown/image-like legacy links (often without extension), return a tiny transparent image.
  res.status(200).type("image/gif").send(TRANSPARENT_GIF_1X1);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (process.env.DATABASE_URL) {
    await ensureUserColumns();
    await ensurePostsFeedSchema();
    await ensureChatVibeSchema();
    await ensureCallTranscriptsSchema();
    await ensureChatCodesSchema();
    await ensureContentReportsSchema();
    await ensureSessionTable();
  }
  // CORS для /uploads не перезаписываем: глобальный CORS уже выставил Allow-Origin (origin или capacitor://localhost при Bearer).
  // Раньше здесь ставили "*", из-за чего в приложении с Bearer браузер отклонял ответ (с credentials нельзя *).
  ensureUploadsDirs();
  app.get("/api/health", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, uptimeSec: Math.floor(process.uptime()) });
  });
  registerInternalParserPublishRoutes(app);
  registerInternalApiHubIssueBearerRoutes(app);
  app.use("/uploads/chat", (req: Request, res: Response, next: NextFunction) => {
    // Chat media can contain private user data; disable long-lived browser/proxy caching.
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    const enforce = process.env.UPLOADS_CHAT_PRIVATE_ENFORCE === "1";
    const exp = typeof req.query.exp === "string" ? req.query.exp : "";
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";
    const fullPath = `/uploads/chat${req.path.startsWith("/") ? "" : "/"}${req.path}`;
    const ok = Boolean(exp && sig && verifySignedUploadPathAny([fullPath, req.path], exp, sig));
    if (ok) {
      next();
      return;
    }
    logSecurityAuditEvent("uploads_chat_unsigned_access", {
      path: req.path,
      method: req.method,
      requestId: req.requestId ?? null,
      enforce,
    });
    if (enforce) {
      res.status(403).json({ message: "Signed URL is required for chat media" });
      return;
    }
    next();
  });
  app.use("/uploads/voice", (req: Request, res: Response, next: NextFunction) => {
    // Voice media is sensitive personal data.
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    const enforce = process.env.UPLOADS_VOICE_PRIVATE_ENFORCE === "1";
    const exp = typeof req.query.exp === "string" ? req.query.exp : "";
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";
    const fullPath = `/uploads/voice${req.path.startsWith("/") ? "" : "/"}${req.path}`;
    const ok = Boolean(exp && sig && verifySignedUploadPathAny([fullPath, req.path], exp, sig));
    if (ok) {
      next();
      return;
    }
    logSecurityAuditEvent("uploads_voice_unsigned_access", {
      path: req.path,
      method: req.method,
      requestId: req.requestId ?? null,
      enforce,
    });
    if (enforce) {
      res.status(403).json({ message: "Signed URL is required for voice media" });
      return;
    }
    next();
  });
  app.use(
    "/uploads",
    express.static(UPLOADS_ROOT, {
      immutable: true,
      maxAge: "365d",
      // Иначе при отсутствии файла сразу 404 и не вызывается GET /uploads/:bucket/:name → плейсхолдер (меньше шума в консоли).
      fallthrough: true,
    })
  );
  app.get("/uploads/:bucket/:name", (req: Request, res: Response, next: NextFunction) => {
    const bucket = String(req.params.bucket || "").trim();
    const name = String(req.params.name || "").trim();
    if (!bucket || !name) {
      next();
      return;
    }
    const resolvedName = resolveLegacyUploadName(bucket, name);
    if (!resolvedName) {
      sendMissingUploadPlaceholder(res, name);
      return;
    }
    const target = `/uploads/${bucket}/${resolvedName}`;
    res.redirect(302, target);
  });

  // Сессия должна быть ДО любых маршрутов с requireAuth, иначе req.session не заполняется → 401 на /api/calls/token и др.
  setupSession(app);
  setupAbuseGuard(app);
  // CSRF защита только для cookie-сессий; Bearer-запросы пропускаются.
  app.use(csrfProtectionMiddleware);
  // Обновляем lastSeen при каждом запросе авторизованного пользователя (для статуса «в сети»)
  const { getUserId } = await import("./auth/session");
  const { storage } = await import("./storage");
  app.use((req, _res, next) => {
    const userId = getUserId(req);
    if (userId) {
      storage.updateUserLastSeen(userId).catch((err) => {
        console.warn("[lastSeen] middleware update failed", {
          userId,
          rid: req.requestId,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }
    next();
  });

  app.use(apiTrafficRecordMiddleware);
  app.use(apiTrafficModuleTelemetryMiddleware);

  registerCallRoutes(app);
  registerGroupCallRoutes(app);
  attachCallWebSocket(httpServer);
  attachGroupCallTransport(httpServer);
  startAdminMetricsCollector();

  app.get("/api/build-info", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      version: process.env.BUILD_VERSION || "?",
      note: "Если на странице входа внизу версия не совпадает — обнови страницу: Ctrl+Shift+R (или Cmd+Shift+R)",
    });
  });

  app.get("/api/time", (_req, res) => {
    const now = new Date();
    res.setHeader("Cache-Control", "no-store");
    res.json({ serverTime: now.toISOString(), serverTimeMs: now.getTime() });
  });

  registerOpsPlatformPublicRoute(app);
  registerClientTelemetryRoutes(app);

  registerAuthRoutes(app);
  registerPingokMicroRoutes(app);
  registerRemindersRoutes(app);
  registerServiceChatRoutes(app);
  registerBusinessChatRoutes(app);
  registerEdgeRoutes(app);
  registerSenderRoutes(app);
  registerOpsUserReportsRoute(app);
  registerAdminRoutes(app);
  registerReferralRoutes(app);
  registerHelpPagesRoutes(app);
  registerUsersRoutes(app);
  registerProfilePinsRoutes(app);
  registerGeoRoutes(app);
  registerChatsRoutes(app);
  registerMessagesRoutes(app);
  registerAiChatRoutes(app);
  registerAiSearchRoutes(app);
  registerSpellcheckRoutes(app);
  registerLinkPreviewRoutes(app);
  registerTranslateRoutes(app);
  registerVibeRoutes(app);
  registerSavedMessagesRoutes(app);
  registerTracksRoutes(app);
  registerCallTranscriptRoutes(app);
  registerVoiceUploadRoutes(app);
  registerPostMediaUploadRoutes(app);
  registerStoryMediaUploadRoutes(app);
  registerChatMediaUploadRoutes(app);
  registerStickerPackRoutes(app);
  registerAvatarUploadRoutes(app);
  registerCoverUploadRoutes(app);
  registerCommentsRoutes(app);
  registerPostsRoutes(app);
  registerReactionsRoutes(app);
  registerStoriesRoutes(app);
  registerNotificationsRoutes(app);
  registerPushFeedRoutes(app);
  return httpServer;
}
