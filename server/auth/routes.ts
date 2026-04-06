import express, { type Express, type Request, type Response } from "express";
import { storage } from "../storage";
import { hashPassword, verifyPassword } from "./password";
import { normalizePhone } from "./phone";
import { buildUserInsertWithPhone } from "./phone-at-rest";
import { loginLimiter, registerLimiter } from "./rate-limit";
import { assertReferralValidForSignup } from "../referrals/signup-code-validation";
import { createToken, revokeAllUserBearerTokens, revokeBearerToken } from "./token";
import { getUserId, requireAuth } from "./session";
import { normalizeGenderValue } from "../users/service";
import { bootstrapServiceThreadForNewUser } from "../service-chat/service";
import { bootstrapReferralCodeForNewUser } from "../referrals/bootstrap-new-user";
import { extractSignupTelemetry } from "./signup-signals";
import { getDb } from "../db";
import { dbStorageGetReferralCodeEdgeMoneyBatchId } from "../storage/db-storage-referral-batch-id";
import { selectEdgeMoneyInviteBatchMeta } from "../edge-money-invite";
import {
  confirmPhoneCallVerification,
  consumePhoneVerificationTicket,
  isNewTelCallPasswordEnabled,
  startPhoneCallVerification,
} from "./new-tel";
import { handleNewTelCallPasswordIdWebhook } from "./new-tel/callpassword-id-webhook";
import { resolveNewTelWebhookPublicBaseUrl } from "./new-tel/resolve-new-tel-webhook-public-url";
import { platformGetPublic } from "../admin/ops/platform.repo";
import { isRegistrationPhoneCallVerificationRequiredResolved } from "./registration-phone-verification-policy";
import { registerPasswordResetRoutes } from "./register-password-reset-routes";
import { matchAppStoreReviewReferralCode } from "./app-store-review-referral";
import { resolveMediaUrlForClient } from "../upload/s3-presign-media-urls";

function isDbConnectionError(msg: string): boolean {
  return /password authentication failed|connection refused|ECONNREFUSED|connect ETIMEDOUT/i.test(msg);
}

function deriveBoardApiHubAccess(user: { boardApiHubPrimeCode?: string | null }): boolean {
  const p = user.boardApiHubPrimeCode;
  return typeof p === "string" && p.trim().length > 0;
}

export function registerAuthRoutes(app: Express): void {
  registerPasswordResetRoutes(app);

  /**
   * New-Tel CallPassword: колбэк после звонка пользователя на confirmationNumber.
   * Должен быть публичным POST без сессии (внешний провайдер).
   */
  app.post("/api/auth/new-tel/callpassword-id/webhook", handleNewTelCallPasswordIdWebhook);

  const PHONE_VERIFICATION_START_MESSAGE =
    "Если номер доступен для регистрации, вам поступит звонок с кодом подтверждения.";
  /** Публично: нужен ли клиенту шаг подтверждения звонком (исходящий звонок на номер New-Tel) при регистрации. */
  app.get("/api/auth/phone-verification/config", async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    try {
      const p = await platformGetPublic();
      const phoneCallVerificationRequired = await isRegistrationPhoneCallVerificationRequiredResolved(p);
      res.json({
        phoneCallVerificationRequired,
        registrationPhoneCallVerificationEnabled: p.registrationPhoneCallVerificationEnabled,
        forcedByEnv: false,
      });
    } catch (e) {
      console.error("[auth] GET /api/auth/phone-verification/config", e);
      /* Не подставляем «звонок обязателен»: иначе UI расходится с выключенной админкой при сбое БД. Регистрацию всё равно валидирует POST /register. */
      res.json({
        phoneCallVerificationRequired: false,
        registrationPhoneCallVerificationEnabled: false,
        forcedByEnv: false,
      });
    }
  });

  app.post("/api/auth/phone-verification/start", registerLimiter, async (req: Request, res: Response) => {
    try {
      const required = await isRegistrationPhoneCallVerificationRequiredResolved();
      if (!required) {
        res.status(400).json({
          message: "Сейчас регистрация без подтверждения звонком. Обновите страницу и зарегистрируйтесь с паролем.",
        });
        return;
      }
      if (!isNewTelCallPasswordEnabled()) {
        res.status(503).json({
          message:
            "Подтверждение звонком включено в настройках, но New-Tel не настроен на сервере. Обратитесь к администратору или задайте NEW_TEL_AUTH_KEY и NEW_TEL_SIGN_KEY.",
        });
        return;
      }
      const { phone: rawPhone } = req.body ?? {};
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        res.status(400).json({ message: "Укажите номер телефона в формате +7XXXXXXXXXX или 8XXXXXXXXXX" });
        return;
      }
      const existing = await storage.getUserByPhone(phone);
      if (existing) {
        // Единый ответ, чтобы не раскрывать существование аккаунта по номеру.
        res.status(200).json({ ok: true, message: PHONE_VERIFICATION_START_MESSAGE });
        return;
      }
      let publicBase: string;
      try {
        publicBase = resolveNewTelWebhookPublicBaseUrl(req);
      } catch (e) {
        const hint = e instanceof Error ? e.message : "Задайте PUBLIC_APP_URL или NEW_TEL_WEBHOOK_PUBLIC_BASE_URL.";
        res.status(503).json({ message: hint });
        return;
      }
      const started = await startPhoneCallVerification(phone, publicBase);
      res.json(started);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось начать подтверждение номера";
      res.status(400).json({ message: msg });
    }
  });

  app.post("/api/auth/phone-verification/confirm", registerLimiter, async (req: Request, res: Response) => {
    try {
      const { challengeId, phone: rawPhone, pin } = req.body ?? {};
      const challengeIdValue = typeof challengeId === "string" ? challengeId.trim() : "";
      const phone = normalizePhone(rawPhone);
      const pinValue = typeof pin === "string" ? pin.trim() : "";
      if (!challengeIdValue) {
        res.status(400).json({ message: "Не найдена сессия подтверждения. Запросите звонок ещё раз." });
        return;
      }
      if (!phone) {
        res.status(400).json({ message: "Укажите номер телефона в формате +7XXXXXXXXXX или 8XXXXXXXXXX" });
        return;
      }
      if (pinValue && !/^\d{4}$/.test(pinValue)) {
        res.status(400).json({ message: "Неверный формат кода (не используется при звонке на номер подтверждения)." });
        return;
      }
      const confirmed = await confirmPhoneCallVerification(challengeIdValue, phone, pinValue);
      res.json(confirmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось подтвердить номер";
      res.status(400).json({ message: msg });
    }
  });

  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response) => {
    try {
    const { phone: rawPhone, password, referralCode: rawReferralCode } = req.body ?? {};
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      res.status(400).json({ message: "Укажите номер телефона в формате +7XXXXXXXXXX или 8XXXXXXXXXX" });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ message: "Пароль не менее 6 символов" });
      return;
    }
    const existing = await storage.getUserByPhone(phone);
    if (existing) {
      res.status(409).json({ message: "Этот номер уже зарегистрирован" });
      return;
    }
    if (await isRegistrationPhoneCallVerificationRequiredResolved()) {
      const rawTicket = (req.body as { phoneVerificationTicket?: unknown } | undefined)?.phoneVerificationTicket;
      const ticket = typeof rawTicket === "string" ? rawTicket.trim() : "";
      if (!ticket || !consumePhoneVerificationTicket(phone, ticket)) {
        res.status(400).json({ message: "Сначала подтвердите номер телефона звонком." });
        return;
      }
    }

    const stats = await storage.getAdminStats();
    const isBootstrap = stats.total === 0;
    if (!isBootstrap) {
      try {
        const { platformGetPublic } = await import("../admin/ops/platform.repo");
        if ((await platformGetPublic()).maintenanceMode) {
          res.status(503).json({ message: "Регистрация временно приостановлена. Попробуйте позже." });
          return;
        }
      } catch {
        /* без БД — пропускаем */
      }
    }
    let invitedById: string | undefined;
    let referralCodeId: string | undefined;

    if (!isBootstrap) {
      const reviewMatch = await matchAppStoreReviewReferralCode(storage, rawReferralCode, isBootstrap);
      if (reviewMatch.kind === "misconfigured") {
        res.status(503).json({
          message:
            "Ревью-код настроен на сервере, но нет пользователя +79956012736 и ни одного админа. Выполните npm run seed:first-user или задайте другой код в APP_STORE_REVIEW_REFERRAL_CODE.",
        });
        return;
      }
      if (reviewMatch.kind === "ok") {
        invitedById = reviewMatch.invitedById;
      } else {
        const refVal = await assertReferralValidForSignup(rawReferralCode);
        if (!refVal.ok) {
          res.status(400).json({ message: refVal.message });
          return;
        }
        invitedById = refVal.referral.inviterUserId;
        referralCodeId = refVal.referral.id;
      }
    }

    const publicId = await storage.getNextPublicId();
    const signupTelemetry = extractSignupTelemetry(req, req.body);
    const user = await storage.createUser(
      buildUserInsertWithPhone(phone, {
        password: hashPassword(password),
        publicId,
        ...(invitedById && { invitedById }),
        ...signupTelemetry,
      }),
    );
    if (referralCodeId) {
      const edgeMoneyBatchId = await dbStorageGetReferralCodeEdgeMoneyBatchId(getDb(), referralCodeId);
      const consumed = await storage.consumeReferralCode(referralCodeId);
      if (!consumed) {
        await storage.setUserDeleted(user.id, true);
        res.status(409).json({
          message: "Код приглашения больше недействителен (уже использован или истёк). Обновите страницу и попробуйте снова.",
        });
        return;
      }
      if (edgeMoneyBatchId && invitedById) {
        const meta = await selectEdgeMoneyInviteBatchMeta(getDb(), edgeMoneyBatchId);
        const { notifyEdgeMoneyInviteBatchAfterReferralConsumed } = await import(
          "../edge-money-invite/after-consume/notify-edge-money-after-referral-consumed"
        );
        await notifyEdgeMoneyInviteBatchAfterReferralConsumed(edgeMoneyBatchId);
        if (meta?.inviterUserId === invitedById) {
          void import("../edge/forward-money-invite-registered").then(
            async ({ forwardMoneyInviteRegisteredToEdge }) => {
              try {
                await forwardMoneyInviteRegisteredToEdge({
                  edgeId: meta.edgeId,
                  inviterPlatformUserId: invitedById,
                  referralCodeId,
                  inviteePlatformUserId: user.id,
                });
              } catch (e) {
                console.error("[auth/register] forwardMoneyInviteRegisteredToEdge", e);
              }
            },
          );
        }
      }
    }
    if (invitedById) {
      try {
        const { notifyChatListUpdate } = await import("../calls/ws");
        const chat = await storage.getOrCreateDmChat(invitedById, user.id);
        notifyChatListUpdate(invitedById);
        await storage.createMessage({
          chatId: chat.id,
          senderId: invitedById,
          type: "text",
          content: "Ура! Ты теперь тоже с нами",
        });
      } catch (e) {
        console.error("Create welcome chat for invitee:", e);
      }
    }
    try {
      await bootstrapServiceThreadForNewUser(user.id);
    } catch (e) {
      console.error("[service-chat/register-bootstrap]", e);
    }
    try {
      await bootstrapReferralCodeForNewUser(user.id);
    } catch (e) {
      console.error("[referrals/register-bootstrap]", e);
    }
    if (!req.session) {
      console.error("[auth/register] session not available");
      res.status(500).json({ message: "Ошибка регистрации. Попробуйте позже." });
      return;
    }
    req.session.userId = user.id;
    const token = createToken(user.id);
    req.session.save((err) => {
      if (err) {
        console.error("[auth] session save failed (register):", err);
        res.status(500).json({ message: "Ошибка сохранения сессии" });
        return;
      }
      res.status(201).json({
        id: user.id,
        publicId: user.publicId,
        displayName: user.displayName ?? null,
        surname: user.surname ?? null,
        nickname: user.nickname ?? null,
        gender: normalizeGenderValue(user.gender) ?? null,
        birthDate: user.birthDate ?? null,
        avatarUrl: user.avatarUrl ?? null,
        coverUrl: user.coverUrl ?? null,
        showCover: (user as { showCover?: boolean }).showCover !== false,
        profileLink: user.profileLink ?? null,
        city: (user as { city?: string | null }).city ?? null,
        platformRole: user.platformRole ?? "user",
        hideFromSearch: user.hideFromSearch ?? false,
        bio: user.bio ?? null,
        createdAt: (user as { createdAt?: Date | null }).createdAt
          ? new Date((user as { createdAt: Date }).createdAt).toISOString()
          : null,
        boardApiHubAccess: deriveBoardApiHubAccess(user),
        token,
      });
    });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (isDbConnectionError(msg)) {
        res.status(503).json({ message: "Сервер не может подключиться к базе данных. Проверьте DATABASE_URL в .env на сервере." });
        return;
      }
      console.error("[auth/register]", err);
      res.status(500).json({ message: "Ошибка регистрации. Попробуйте позже." });
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const { phone: rawPhone, password } = req.body ?? {};
      const raw = typeof rawPhone === "string" ? rawPhone.trim().toLowerCase() : "";
      const phone = raw === "admin" ? "admin" : normalizePhone(rawPhone);
      if (!phone) {
        res.status(400).json({ message: "Укажите номер телефона в формате +7XXXXXXXXXX или 8XXXXXXXXXX" });
        return;
      }
      if (!password || typeof password !== "string") {
        res.status(400).json({ message: "Введите пароль" });
        return;
      }
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        if (phone === "admin") {
          res.status(401).json({
            message: "Админ-аккаунт не найден. Выполните `npm run seed:admin` и попробуйте снова.",
          });
          return;
        }
        res.status(401).json({ message: "Неверный номер или пароль" });
        return;
      }
      if ((user as { deletedAt?: Date | null }).deletedAt) {
        res.status(401).json({ message: "Аккаунт удалён" });
        return;
      }
      const storedHash = user.password;
      if (!storedHash || typeof storedHash !== "string") {
        console.error("[auth/login] user has no password hash, userId:", user.id);
        res.status(500).json({ message: "Ошибка входа. Обратитесь в поддержку." });
        return;
      }
      if (!verifyPassword(password, storedHash)) {
        res.status(401).json({ message: "Неверный номер или пароль" });
        return;
      }
      if (user.isBlocked) {
        res.status(403).json({ message: "Аккаунт заблокирован администратором" });
        return;
      }
      if (!req.session) {
        console.error("[auth/login] session not available");
        res.status(500).json({ message: "Ошибка входа. Попробуйте позже." });
        return;
      }
      req.session.userId = user.id;
      const token = createToken(user.id);
      req.session.save((err) => {
        if (err) {
          console.error("[auth] session save failed (login):", err);
          res.status(500).json({ message: "Ошибка сохранения сессии" });
          return;
        }
        res.json({
          id: user.id,
          publicId: user.publicId,
          displayName: user.displayName ?? null,
          surname: user.surname ?? null,
          nickname: user.nickname ?? null,
          gender: normalizeGenderValue(user.gender) ?? null,
          birthDate: user.birthDate ?? null,
          avatarUrl: user.avatarUrl ?? null,
          coverUrl: user.coverUrl ?? null,
          showCover: (user as { showCover?: boolean }).showCover !== false,
          profileLink: user.profileLink ?? null,
          city: (user as { city?: string | null }).city ?? null,
          platformRole: user.platformRole ?? "user",
          hideFromSearch: user.hideFromSearch ?? false,
          bio: user.bio ?? null,
          createdAt: (user as { createdAt?: Date | null }).createdAt
            ? new Date((user as { createdAt: Date }).createdAt).toISOString()
            : null,
          boardApiHubAccess: deriveBoardApiHubAccess(user),
          token,
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (isDbConnectionError(msg)) {
        res.status(503).json({ message: "Сервер не может подключиться к базе данных. Проверьте DATABASE_URL в .env на сервере." });
        return;
      }
      console.error("[auth/login]", err);
      res.status(500).json({ message: "Ошибка входа. Попробуйте позже." });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (bearer) revokeBearerToken(bearer);
    req.session?.destroy(() => {});
    res.json({ ok: true });
  });

  /** Инвалидировать все Bearer-токены пользователя (security reset). */
  app.post("/api/auth/logout-all", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    revokeAllUserBearerTokens(userId);
    req.session?.destroy(() => {});
    res.json({ ok: true });
  });

  /** Удаление своего аккаунта (требование App Store для приложений с регистрацией). */
  app.delete("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    try {
      await storage.setUserDeleted(userId, true);
      req.session?.destroy(() => {});
      res.json({ ok: true });
    } catch (err) {
      console.error("[auth/delete-account]", err);
      res.status(500).json({ message: "Не удалось удалить аккаунт. Попробуйте позже." });
    }
  });

  /** Текущий пользователь. Без сессии/токена — 200 и {}, чтобы не засорять консоль 401. */
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(200).json({});
        return;
      }
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(200).json({});
        return;
      }
      if ((user as { deletedAt?: Date | null }).deletedAt) {
        res.status(200).json({});
        return;
      }
      if (user.isBlocked) {
        res.status(403).json({ message: "Аккаунт заблокирован" });
        return;
      }
      storage.updateUserLastSeen(user.id).catch((err) => {
        console.warn("[lastSeen] GET /auth/me failed", {
          userId: user.id,
          rid: req.requestId,
          err: err instanceof Error ? err.message : String(err),
        });
      });
      const boardApiHubAccess = deriveBoardApiHubAccess(user);
      const businessStatus =
        (user as { businessStatus?: string | null }).businessStatus === "pending" ||
        (user as { businessStatus?: string | null }).businessStatus === "approved" ||
        (user as { businessStatus?: string | null }).businessStatus === "rejected" ||
        (user as { businessStatus?: string | null }).businessStatus === "revision_required"
          ? String((user as { businessStatus?: string | null }).businessStatus)
          : "none";
      const [avatarUrl, coverUrl] = await Promise.all([
        resolveMediaUrlForClient(user.avatarUrl ?? null),
        resolveMediaUrlForClient(user.coverUrl ?? null),
      ]);
      res.json({
        id: user.id,
        publicId: user.publicId,
        displayName: user.displayName ?? null,
        surname: user.surname ?? null,
        nickname: user.nickname ?? null,
        gender: normalizeGenderValue(user.gender) ?? null,
        birthDate: user.birthDate ?? null,
        avatarUrl,
        coverUrl,
        showCover: (user as { showCover?: boolean }).showCover !== false,
        profileLink: user.profileLink ?? null,
        city: (user as { city?: string | null }).city ?? null,
        platformRole: user.platformRole ?? "user",
        hideFromSearch: user.hideFromSearch ?? false,
        bio: user.bio ?? null,
        pushEnabled: (user as { pushEnabled?: boolean }).pushEnabled !== false,
        vibeEnabled: (user as { vibeEnabled?: boolean }).vibeEnabled === true,
        vibeShareWithPartner: (user as { vibeShareWithPartner?: boolean }).vibeShareWithPartner === true,
        dmPolicy: (user as { dmPolicy?: string }).dmPolicy ?? "all",
        groupAddMePolicy: (user as { groupAddMePolicy?: string }).groupAddMePolicy ?? "all",
        createdAt: (user as { createdAt?: Date | null }).createdAt
          ? new Date((user as { createdAt: Date }).createdAt).toISOString()
          : null,
        boardApiHubAccess,
        businessStatus,
        businessContactPhone:
          businessStatus === "approved"
            ? ((user as { businessContactPhone?: string | null }).businessContactPhone ?? null)
            : null,
        businessAddress:
          businessStatus === "approved"
            ? ((user as { businessAddress?: string | null }).businessAddress ?? null)
            : null,
      });
    } catch (err) {
      console.error("[auth/me]", err);
      if (res.headersSent) return;
      /** При активной сессии пустой 200 {} ломает клиент (сброс user). Для сбоев БД — 503 и кеш /me в приложении. */
      const authed = Boolean(getUserId(req));
      if (authed) {
        res.status(503).json({
          message: "Не удалось загрузить профиль. Попробуйте снова.",
          code: "auth_me_unavailable",
          retryable: true,
        });
        return;
      }
      res.status(200).json({});
    }
  });
}
