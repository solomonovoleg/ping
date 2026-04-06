import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { generateReferralCode } from "../../referrals/code-generator";
import { requireAdmin, requireAdminOrSuper } from "../middleware";
import {
  approveInviteMoreRequest,
  listPendingInviteMoreRequests,
  rejectInviteMoreRequest,
} from "../../referrals/invite-more-service";
import {
  getReferralProgramSettings,
  updateReferralProgramSettings,
} from "../../referrals/settings";

const ADMIN_CODE_TTL_HOURS = 7 * 24; // 7 дней для админских кодов

const ADMIN_NOTE_MAX_LEN = 500;

function normalizeAdminReferralNote(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return undefined;
  return s.length > ADMIN_NOTE_MAX_LEN ? s.slice(0, ADMIN_NOTE_MAX_LEN) : s;
}

type ReqWithAdmin = Request & { adminUserId: string };

export function registerAdminReferralRoutes(app: Express): void {
  /** Создать пригласительный код (админ — без лимита). Тело: { expiresInHours?: number, multiUse?, maxUses?, adminNote? } */
  app.post("/api/admin/referrals/create", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const settings = await getReferralProgramSettings();
    const multiUse = req.body?.multiUse === true;
    const fallbackHours = multiUse
      ? settings.multiUseDefaultExpiresHours
      : ADMIN_CODE_TTL_HOURS;
    const expiresInHours = typeof req.body?.expiresInHours === "number" && req.body.expiresInHours > 0
      ? Math.min(req.body.expiresInHours, 30 * 24) // макс 30 дней
      : fallbackHours;
    let maxUses = 1;
    if (multiUse) {
      maxUses = -1;
    } else if (typeof req.body?.maxUses === "number" && req.body.maxUses > 1) {
      maxUses = Math.min(Math.floor(req.body.maxUses), 10_000);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    let code = generateReferralCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await storage.getReferralCodeByCode(code);
      if (!existing) break;
      code = generateReferralCode();
      attempts++;
    }

    const adminNote = normalizeAdminReferralNote(req.body?.adminNote ?? req.body?.note);
    const created = await storage.createReferralCode(adminUserId, code, expiresAt, { maxUses, adminNote });
    res.status(201).json({
      id: created.id,
      code: created.code,
      expiresAt: created.expiresAt.toISOString(),
      expiresInHours,
      maxUses: created.maxUses,
      adminNote: created.adminNote ?? null,
    });
  });

  /** Список активных кодов, созданных админом */
  app.get("/api/admin/referrals/codes", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const list = await storage.listActiveReferralCodesByInviter(adminUserId);
    res.json({
      codes: list.map((c) => ({
        id: c.id,
        code: c.code,
        expiresAt: c.expiresAt.toISOString(),
        maxUses: c.maxUses,
        useCount: c.useCount,
        adminNote: c.adminNote ?? null,
      })),
    });
  });

  app.get("/api/admin/referrals/settings", requireAdminOrSuper, async (_req: Request, res: Response) => {
    try {
      const settings = await getReferralProgramSettings();
      res.json(settings);
    } catch (e) {
      console.error("[admin/referrals/settings get]", e);
      res.status(500).json({ message: "Не удалось загрузить настройки приглашений" });
    }
  });

  app.patch("/api/admin/referrals/settings", requireAdminOrSuper, async (req: Request, res: Response) => {
    try {
      const next = await updateReferralProgramSettings({
        defaultInvites: req.body?.defaultInvites,
        repeatEnabled: req.body?.repeatEnabled,
        repeatInvites: req.body?.repeatInvites,
        repeatAfterHours: req.body?.repeatAfterHours,
        multiUseDefaultExpiresHours: req.body?.multiUseDefaultExpiresHours,
      });
      res.json(next);
    } catch (e) {
      console.error("[admin/referrals/settings patch]", e);
      res.status(500).json({ message: "Не удалось сохранить настройки приглашений" });
    }
  });

  /** Заявки пользователей на доп. приглашения (модератор и выше). */
  app.get("/api/admin/invite-more-requests", requireAdmin, async (req: Request, res: Response) => {
    try {
      const list = await listPendingInviteMoreRequests(100);
      res.json({
        requests: list.map((r) => ({
          id: r.id,
          userId: r.userId,
          message: r.message,
          createdAt: r.createdAt != null ? r.createdAt.toISOString() : new Date().toISOString(),
          bonusInvites: r.bonusInvites,
          displayName: r.displayName,
          surname: r.surname,
          publicId: r.publicId,
        })),
      });
    } catch (e) {
      console.error("[admin/invite-more-requests]", e);
      res.status(500).json({ message: "Не удалось загрузить заявки" });
    }
  });

  app.patch("/api/admin/invite-more-requests/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    const action = req.body?.action === "reject" ? "reject" : req.body?.action === "approve" ? "approve" : "";
    if (!id || !action) {
      res.status(400).json({ message: "Укажите id и action: approve | reject" });
      return;
    }
    try {
      if (action === "approve") {
        const ok = await approveInviteMoreRequest(id, adminUserId, req.body?.bonusInvites);
        if (!ok) {
          res.status(404).json({ message: "Заявка не найдена или уже обработана" });
          return;
        }
        res.json({ ok: true });
        return;
      }
      const ok = await rejectInviteMoreRequest(id, adminUserId);
      if (!ok) {
        res.status(404).json({ message: "Заявка не найдена или уже обработана" });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/invite-more-requests patch]", e);
      res.status(500).json({ message: "Не удалось обработать заявку" });
    }
  });
}
