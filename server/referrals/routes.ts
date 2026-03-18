import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, getUserId } from "../auth/session";
import { generateReferralCode, normalizeReferralCodeInput } from "./code-generator";

const REFERRAL_LIMIT = 3;
const CODE_TTL_HOURS = 12;

export function registerReferralRoutes(app: Express): void {
  /** Создать пригласительный код (только для авторизованных, лимит 3 приглашённых). Тело: { format?: "phrase" | "digits" } — фраза или 4 цифры. */
  app.post("/api/referrals/create", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Войдите, чтобы создать приглашение" });
      return;
    }
    const count = await storage.countReferralsByInviter(userId);
    if (count >= REFERRAL_LIMIT) {
      res.status(403).json({
        message: `Вы уже пригласили максимальное число пользователей (${REFERRAL_LIMIT}). Лимит пока не увеличиваем.`,
      });
      return;
    }
    const format = (req.body?.format === "digits" ? "digits" : "phrase") as "phrase" | "digits";
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CODE_TTL_HOURS);
    let code = generateReferralCode(format);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await storage.getReferralCodeByCode(code);
      if (!existing) break;
      code = generateReferralCode(format);
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
  app.get("/api/referrals/check", async (req: Request, res: Response) => {
    const raw = typeof req.query.code === "string" ? req.query.code : "";
    const code = normalizeReferralCodeInput(raw);
    if (!code) {
      res.status(400).json({ valid: false, message: "Укажите код приглашения" });
      return;
    }
    const row = await storage.getReferralCodeByCode(code);
    if (!row) {
      res.status(200).json({ valid: false, message: "Код не найден, истёк или уже использован" });
      return;
    }
    const inviter = await storage.getUser(row.inviterUserId);
    const inviterName =
      inviter && (inviter.displayName || inviter.surname)
        ? [inviter.displayName, inviter.surname].filter(Boolean).join(" ").trim()
        : null;
    res.json({
      valid: true,
      inviterName: inviterName || `ID ${inviter?.publicId ?? ""}`,
      expiresAt: row.expiresAt.toISOString(),
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
    const list = await storage.listActiveReferralCodesByInviter(userId);
    const count = await storage.countReferralsByInviter(userId);
    res.json({
      codes: list.map((c) => ({
        id: c.id,
        code: c.code,
        expiresAt: c.expiresAt.toISOString(),
      })),
      usedCount: count,
      limit: REFERRAL_LIMIT,
      remaining: Math.max(0, REFERRAL_LIMIT - count),
    });
  });
}
