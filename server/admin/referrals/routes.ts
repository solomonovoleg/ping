import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { generateReferralCode } from "../../referrals/code-generator";
import { requireAdminOrSuper } from "../middleware";

const CODE_TTL_HOURS = 12;
const ADMIN_CODE_TTL_HOURS = 7 * 24; // 7 дней для админских кодов

type ReqWithAdmin = Request & { adminUserId: string };

export function registerAdminReferralRoutes(app: Express): void {
  /** Создать пригласительный код (админ — без лимита). Тело: { format?: "phrase" | "digits", expiresInHours?: number } */
  app.post("/api/admin/referrals/create", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const format = (req.body?.format === "digits" ? "digits" : "phrase") as "phrase" | "digits";
    const expiresInHours = typeof req.body?.expiresInHours === "number" && req.body.expiresInHours > 0
      ? Math.min(req.body.expiresInHours, 30 * 24) // макс 30 дней
      : ADMIN_CODE_TTL_HOURS;
    const multiUse = req.body?.multiUse === true;
    let maxUses = 1;
    if (multiUse) {
      maxUses = -1;
    } else if (typeof req.body?.maxUses === "number" && req.body.maxUses > 1) {
      maxUses = Math.min(Math.floor(req.body.maxUses), 10_000);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    let code = generateReferralCode(format);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await storage.getReferralCodeByCode(code);
      if (!existing) break;
      code = generateReferralCode(format);
      attempts++;
    }

    const created = await storage.createReferralCode(adminUserId, code, expiresAt, { maxUses });
    res.status(201).json({
      id: created.id,
      code: created.code,
      expiresAt: created.expiresAt.toISOString(),
      expiresInHours,
      maxUses: created.maxUses,
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
      })),
    });
  });
}
