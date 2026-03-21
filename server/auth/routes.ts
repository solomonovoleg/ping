import express, { type Express, type Request, type Response } from "express";
import { storage } from "../storage";
import { hashPassword, verifyPassword } from "./password";
import { normalizePhone } from "./phone";
import { loginLimiter, registerLimiter } from "./rate-limit";
import { normalizeReferralCodeInput } from "../referrals/code-generator";
import { createToken } from "./token";
import { getUserId, requireAuth } from "./session";

const DEFAULT_REFERRAL_LIMIT = 3;

function getInviterReferralLimit(inviter: { referralLimit?: number | null } | undefined): number {
  const limit = inviter?.referralLimit;
  if (limit != null && limit >= 0) return limit;
  return DEFAULT_REFERRAL_LIMIT;
}

function isDbConnectionError(msg: string): boolean {
  return /password authentication failed|connection refused|ECONNREFUSED|connect ETIMEDOUT/i.test(msg);
}

export function registerAuthRoutes(app: Express): void {
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
      const code = normalizeReferralCodeInput(typeof rawReferralCode === "string" ? rawReferralCode : "");
      if (!code) {
        res.status(400).json({ message: "Введите пригласительный код. Регистрация только по приглашению." });
        return;
      }
      const referral = await storage.getReferralCodeByCode(code);
      if (!referral) {
        res.status(400).json({ message: "Код приглашения не найден, истёк или уже использован. Попросите новый код." });
        return;
      }
      const inviter = await storage.getUser(referral.inviterUserId);
      const isAdminInviter = inviter && ["admin", "moderator", "super_admin"].includes(inviter.platformRole ?? "user");
      if (!isAdminInviter) {
        const limit = getInviterReferralLimit(inviter);
        const usedCount = await storage.countReferralsByInviter(referral.inviterUserId);
        if (usedCount >= limit) {
          res.status(400).json({ message: "Пригласивший вас пользователь исчерпал лимит приглашений." });
          return;
        }
      }
      invitedById = referral.inviterUserId;
      referralCodeId = referral.id;
    }

    const publicId = await storage.getNextPublicId();
    const user = await storage.createUser({
      phone,
      password: hashPassword(password),
      publicId,
      ...(invitedById && { invitedById }),
    });
    if (referralCodeId) {
      const consumed = await storage.consumeReferralCode(referralCodeId);
      if (!consumed) {
        await storage.setUserDeleted(user.id, true);
        res.status(409).json({
          message: "Код приглашения больше недействителен (уже использован или истёк). Обновите страницу и попробуйте снова.",
        });
        return;
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
        phone: user.phone,
        displayName: user.displayName ?? null,
        surname: user.surname ?? null,
        nickname: user.nickname ?? null,
        gender: user.gender ?? null,
        birthDate: user.birthDate ?? null,
        avatarUrl: user.avatarUrl ?? null,
        coverUrl: user.coverUrl ?? null,
        showCover: (user as { showCover?: boolean }).showCover !== false,
        profileLink: user.profileLink ?? null,
        platformRole: user.platformRole ?? "user",
        hideFromSearch: user.hideFromSearch ?? false,
        bio: user.bio ?? null,
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
          phone: user.phone,
          displayName: user.displayName ?? null,
          surname: user.surname ?? null,
          nickname: user.nickname ?? null,
          gender: user.gender ?? null,
          birthDate: user.birthDate ?? null,
          avatarUrl: user.avatarUrl ?? null,
          coverUrl: user.coverUrl ?? null,
          showCover: (user as { showCover?: boolean }).showCover !== false,
          profileLink: user.profileLink ?? null,
          platformRole: user.platformRole ?? "user",
          hideFromSearch: user.hideFromSearch ?? false,
          bio: user.bio ?? null,
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
      storage.updateUserLastSeen(user.id).catch(() => {});
      res.json({
        id: user.id,
        publicId: user.publicId,
        phone: user.phone,
        displayName: user.displayName ?? null,
        surname: user.surname ?? null,
        nickname: user.nickname ?? null,
        gender: user.gender ?? null,
        birthDate: user.birthDate ?? null,
        avatarUrl: user.avatarUrl ?? null,
        coverUrl: user.coverUrl ?? null,
        showCover: (user as { showCover?: boolean }).showCover !== false,
        profileLink: user.profileLink ?? null,
        platformRole: user.platformRole ?? "user",
        hideFromSearch: user.hideFromSearch ?? false,
        bio: user.bio ?? null,
        pushEnabled: (user as { pushEnabled?: boolean }).pushEnabled !== false,
        vibeEnabled: (user as { vibeEnabled?: boolean }).vibeEnabled === true,
        vibeShareWithPartner: (user as { vibeShareWithPartner?: boolean }).vibeShareWithPartner === true,
      });
    } catch (err) {
      console.error("[auth/me]", err);
      res.status(200).json({});
    }
  });
}
