import type { Express, Request, Response } from "express";
import { referralsCheckLimiter } from "../auth/rate-limit";
import { storage } from "../storage";
import { requireAuth, getUserId } from "../auth/session";
import { generateReferralCode } from "./code-generator";
import { assertReferralValidForSignup } from "./signup-code-validation";
import { publicCheckAppStoreReviewReferral } from "../auth/app-store-review-referral";
import {
  InviteMoreRequestError,
  getMyPendingInviteRequest,
  submitInviteMoreRequest,
} from "./invite-more-service";
import { getReferralLimitSnapshot } from "./limit-service";
const CODE_TTL_HOURS = 12;

export function registerReferralRoutes(app: Express): void {
  /** Создать пригласительный код (только для авторизованных). Лимит берётся из глобальных настроек + персональных надбавок. */
  app.post("/api/referrals/create", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Войдите, чтобы создать приглашение" });
      return;
    }
    const snap = await getReferralLimitSnapshot(userId);
    const limit = snap.limit;
    const count = await storage.countReferralsByInviter(userId);
    if (count >= limit) {
      res.status(403).json({
        message: `Вы уже пригласили максимальное число пользователей (${limit}).`,
      });
      return;
    }
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CODE_TTL_HOURS);
    let code = generateReferralCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await storage.getReferralCodeByCode(code);
      if (!existing) break;
      code = generateReferralCode();
      attempts++;
    }
    const created = await storage.createReferralCode(userId, code, expiresAt);
    res.status(201).json({
      id: created.id,
      code: created.code,
      expiresAt: created.expiresAt.toISOString(),
      expiresInHours: CODE_TTL_HOURS,
    });
  });

  /** Проверить код (публично): действителен ли, от кого приглашение */
  app.get("/api/referrals/check", referralsCheckLimiter, async (req: Request, res: Response) => {
    const raw = typeof req.query.code === "string" ? req.query.code : "";
    if (!String(raw).trim()) {
      res.status(400).json({ valid: false, message: "Укажите код приглашения" });
      return;
    }
    const reviewUi = await publicCheckAppStoreReviewReferral(storage, raw);
    if (reviewUi) {
      res.json({
        valid: true,
        inviterName: reviewUi.inviterName,
        expiresAt: reviewUi.expiresAt,
      });
      return;
    }
    const v = await assertReferralValidForSignup(raw);
    if (!v.ok) {
      res.status(200).json({ valid: false, message: v.message });
      return;
    }
    const inviter = v.inviter;
    const inviterName =
      inviter && (inviter.displayName || inviter.surname)
        ? [inviter.displayName, inviter.surname].filter(Boolean).join(" ").trim()
        : null;
    res.json({
      valid: true,
      inviterName: inviterName || `ID ${inviter?.publicId ?? ""}`,
      expiresAt: v.referral.expiresAt.toISOString(),
    });
  });

  /** Список пользователей, которых я пригласил (для настроек) */
  app.get("/api/referrals/invited", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const list = await storage.listInvitedUsers(userId);
    res.json(
      list.map((u) => ({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName,
        surname: u.surname,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt?.toISOString?.() ?? null,
      }))
    );
  });

  /** Мои активные коды (для авторизованных) */
  app.get("/api/referrals/my-codes", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Войдите в аккаунт" });
      return;
    }
    const snap = await getReferralLimitSnapshot(userId);
    const limit = snap.limit;
    const list = await storage.listActiveReferralCodesByInviter(userId);
    const count = await storage.countReferralsByInviter(userId);
    res.json({
      codes: list.map((c) => ({
        id: c.id,
        code: c.code,
        expiresAt: c.expiresAt.toISOString(),
      })),
      usedCount: count,
      limit,
      remaining: Math.max(0, limit - count),
      autoGrant: {
        repeatEnabled: snap.auto.repeatEnabled,
        repeatInvites: snap.auto.repeatInvites,
        repeatAfterHours: snap.auto.repeatAfterHours,
        firstLimitReachedAt: snap.auto.firstLimitReachedAt?.toISOString() ?? null,
        bonusGrantedAt: snap.auto.bonusGrantedAt?.toISOString() ?? null,
        nextGrantAt: snap.auto.nextGrantAt?.toISOString() ?? null,
      },
    });
  });

  /** Заявка на увеличение лимита приглашений (одна активная pending на пользователя). */
  app.post("/api/referrals/invite-more-request", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const out = await submitInviteMoreRequest(userId, req.body?.message);
      res.status(201).json(out);
    } catch (e) {
      if (e instanceof InviteMoreRequestError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error("[referrals/invite-more-request]", e);
      res.status(500).json({ message: "Не удалось отправить заявку" });
    }
  });

  app.get("/api/referrals/my-invite-more-request", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const row = await getMyPendingInviteRequest(userId);
      res.json({
        pending: row
          ? {
              id: row.id,
              message: row.message,
              createdAt: (row.createdAt ?? new Date()).toISOString(),
            }
          : null,
      });
    } catch (e) {
      console.error("[referrals/my-invite-more-request]", e);
      res.status(500).json({ message: "Не удалось загрузить статус заявки" });
    }
  });
}
