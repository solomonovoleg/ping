import path from "path";
import fs from "fs";
import type { Express } from "express";
import type { Server } from "http";
import express from "express";
import { setupSession, ensureSessionTable } from "./auth/session";
import { registerAuthRoutes } from "./auth/routes";
import { registerAdminRoutes } from "./admin/routes";
import { registerReferralRoutes } from "./referrals/routes";
import { registerChatsRoutes } from "./chats/routes";
import { registerMessagesRoutes } from "./messages/routes";
import { registerCommentsRoutes } from "./comments/routes";
import { registerPostsRoutes } from "./posts/routes";
import { registerReactionsRoutes } from "./reactions/routes";
import { registerStoriesRoutes } from "./stories/routes";
import { registerNotificationsRoutes } from "./notifications/routes";
import { registerUsersRoutes } from "./users/routes";
import { registerVoiceUploadRoutes } from "./upload/voice";
import { registerPostMediaUploadRoutes } from "./upload/post-media";
import { registerStoryMediaUploadRoutes } from "./upload/story-media";
import { registerChatMediaUploadRoutes } from "./upload/chat-media";
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
import { ensureUserColumns, ensureChatVibeSchema, ensureCallTranscriptsSchema } from "./db";
import { registerOpsPlatformPublicRoute } from "./admin/ops/platform.public-http";
import { registerOpsUserReportsRoute } from "./admin/ops/reports.user-http";
import { registerGeoRoutes } from "./geo/routes";
import { registerProfilePinsRoutes } from "./profile-pins/routes";
import { registerPingokMicroRoutes } from "./pingok-micro/routes";
import { registerRemindersRoutes } from "./reminders/routes";
import { registerServiceChatRoutes } from "./service-chat/routes";
import { registerEdgeRoutes } from "./edge/routes";
import {
  apiTrafficRecordMiddleware,
  createApiShieldMutationLimiter,
  createApiShieldReadLimiter,
} from "./middleware/api-shield";
import { apiTrafficModuleTelemetryMiddleware } from "./admin/telemetry";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const UPLOADS_SUBDIRS = ["voice", "posts", "stories", "avatars", "covers", "chat"];

function ensureUploadsDirs(): void {
  if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  for (const sub of UPLOADS_SUBDIRS) {
    const dir = path.join(UPLOADS_ROOT, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (process.env.DATABASE_URL) {
    await ensureUserColumns();
    await ensureChatVibeSchema();
    await ensureCallTranscriptsSchema();
    await ensureSessionTable();
  }
  // CORS для /uploads не перезаписываем: глобальный CORS уже выставил Allow-Origin (origin или capacitor://localhost при Bearer).
  // Раньше здесь ставили "*", из-за чего в приложении с Bearer браузер отклонял ответ (с credentials нельзя *).
  ensureUploadsDirs();
  app.use(
    "/uploads",
    express.static(UPLOADS_ROOT, {
      immutable: true,
      maxAge: "365d",
    })
  );

  // Сессия должна быть ДО любых маршрутов с requireAuth, иначе req.session не заполняется → 401 на /api/calls/token и др.
  setupSession(app);
  // Обновляем lastSeen при каждом запросе авторизованного пользователя (для статуса «в сети»)
  const { getUserId } = await import("./auth/session");
  const { storage } = await import("./storage");
  app.use((req, _res, next) => {
    const userId = getUserId(req);
    if (userId) storage.updateUserLastSeen(userId).catch(() => {});
    next();
  });

  const apiShieldReadLimiter = createApiShieldReadLimiter();
  const apiShieldMutationLimiter = createApiShieldMutationLimiter();
  app.use(apiTrafficRecordMiddleware);
  app.use(apiTrafficModuleTelemetryMiddleware);
  app.use("/api", apiShieldReadLimiter);
  app.use("/api", apiShieldMutationLimiter);

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

  registerAuthRoutes(app);
  registerPingokMicroRoutes(app);
  registerRemindersRoutes(app);
  registerServiceChatRoutes(app);
  registerEdgeRoutes(app);
  registerOpsUserReportsRoute(app);
  registerAdminRoutes(app);
  registerReferralRoutes(app);
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
  registerAvatarUploadRoutes(app);
  registerCoverUploadRoutes(app);
  registerCommentsRoutes(app);
  registerPostsRoutes(app);
  registerReactionsRoutes(app);
  registerStoriesRoutes(app);
  registerNotificationsRoutes(app);
  return httpServer;
}
