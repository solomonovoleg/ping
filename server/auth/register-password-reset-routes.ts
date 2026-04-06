import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { hashPassword } from "./password";
import { normalizePhone } from "./phone";
import { loginLimiter, passwordResetPollLimiter } from "./rate-limit";
import {
  isNewTelCallPasswordEnabled,
  isPasswordResetChallengeVerified,
  startPasswordResetPhoneVerification,
  confirmPasswordResetPhoneVerification,
  consumePasswordResetTicket,
} from "./new-tel";
import { resolveNewTelWebhookPublicBaseUrl } from "./new-tel/resolve-new-tel-webhook-public-url";

/**
 * Восстановление пароля через тот же канал New-Tel CallPassword, что и регистрация.
 * Если New-Tel выключен — клиент показывает подсказку обратиться в поддержку.
 */
export function registerPasswordResetRoutes(app: Express): void {
  const PASSWORD_RESET_START_GENERIC_MESSAGE =
    "Если аккаунт с таким номером существует, в приложении будет показан номер для подтверждающего звонка.";

  app.get("/api/auth/password-reset/config", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.json({ passwordResetViaCallEnabled: isNewTelCallPasswordEnabled() });
  });

  app.post("/api/auth/password-reset/start", loginLimiter, async (req: Request, res: Response) => {
    try {
      if (!isNewTelCallPasswordEnabled()) {
        res.status(400).json({
          message:
            "Сброс пароля по звонку на этом сервере недоступен. Обратитесь в поддержку из приложения или настройте New-Tel на сервере.",
        });
        return;
      }
      const { phone: rawPhone } = req.body ?? {};
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        res.status(400).json({ message: "Укажите номер телефона в формате +7XXXXXXXXXX или 8XXXXXXXXXX" });
        return;
      }
      const user = await storage.getUserByPhone(phone);
      if (!user || (user as { deletedAt?: Date | null }).deletedAt) {
        res.status(200).json({ ok: true, message: PASSWORD_RESET_START_GENERIC_MESSAGE });
        return;
      }
      if (!(user as { password?: string | null }).password) {
        res.status(200).json({ ok: true, message: PASSWORD_RESET_START_GENERIC_MESSAGE });
        return;
      }
      if (user.isBlocked) {
        res.status(200).json({ ok: true, message: PASSWORD_RESET_START_GENERIC_MESSAGE });
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
      const started = await startPasswordResetPhoneVerification(phone, publicBase);
      res.json(started);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось начать сброс пароля";
      res.status(400).json({ message: msg });
    }
  });

  app.post("/api/auth/password-reset/poll-status", passwordResetPollLimiter, (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!isNewTelCallPasswordEnabled()) {
      res.json({ verified: false });
      return;
    }
    const { challengeId, phone: rawPhone } = req.body ?? {};
    const challengeIdValue = typeof challengeId === "string" ? challengeId.trim() : "";
    const phone = normalizePhone(rawPhone);
    if (!challengeIdValue || !phone) {
      res.json({ verified: false });
      return;
    }
    res.json({ verified: isPasswordResetChallengeVerified(challengeIdValue, phone) });
  });

  app.post("/api/auth/password-reset/confirm", loginLimiter, async (req: Request, res: Response) => {
    try {
      if (!isNewTelCallPasswordEnabled()) {
        res.status(400).json({ message: "Сброс пароля по звонку отключён на сервере." });
        return;
      }
      const { challengeId, phone: rawPhone, pin } = req.body ?? {};
      const challengeIdValue = typeof challengeId === "string" ? challengeId.trim() : "";
      const phone = normalizePhone(rawPhone);
      const pinValue = typeof pin === "string" ? pin.trim() : "";
      if (!challengeIdValue) {
        res.status(400).json({ message: "Не найдена сессия сброса. Запросите звонок ещё раз." });
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
      const confirmed = await confirmPasswordResetPhoneVerification(challengeIdValue, phone, pinValue);
      res.json(confirmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось подтвердить номер";
      res.status(400).json({ message: msg });
    }
  });

  app.post("/api/auth/password-reset/complete", loginLimiter, async (req: Request, res: Response) => {
    try {
      if (!isNewTelCallPasswordEnabled()) {
        res.status(400).json({ message: "Сброс пароля по звонку отключён на сервере." });
        return;
      }
      const { phone: rawPhone, resetTicket, newPassword } = req.body ?? {};
      const phone = normalizePhone(rawPhone);
      const ticket = typeof resetTicket === "string" ? resetTicket.trim() : "";
      const pw = typeof newPassword === "string" ? newPassword : "";
      if (!phone) {
        res.status(400).json({ message: "Укажите номер телефона" });
        return;
      }
      if (!ticket) {
        res.status(400).json({ message: "Сначала подтвердите номер звонком." });
        return;
      }
      if (pw.length < 6) {
        res.status(400).json({ message: "Пароль не менее 6 символов" });
        return;
      }
      if (!consumePasswordResetTicket(phone, ticket)) {
        res.status(400).json({ message: "Сессия сброса истекла или уже использована. Запросите звонок снова." });
        return;
      }
      const user = await storage.getUserByPhone(phone);
      if (!user || (user as { deletedAt?: Date | null }).deletedAt) {
        res.status(404).json({ message: "Аккаунт не найден" });
        return;
      }
      if (user.isBlocked) {
        res.status(403).json({ message: "Аккаунт заблокирован" });
        return;
      }
      const ok = await storage.setUserPasswordHash(user.id, hashPassword(pw));
      if (!ok) {
        res.status(500).json({ message: "Не удалось сохранить пароль. Попробуйте позже." });
        return;
      }
      res.json({ ok: true, message: "Пароль обновлён. Войдите с новым паролем." });
    } catch (err: unknown) {
      console.error("[auth/password-reset/complete]", err);
      res.status(500).json({ message: "Не удалось сменить пароль. Попробуйте позже." });
    }
  });
}
