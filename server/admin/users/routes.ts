import type { Express, Request, Response } from "express";
import type { UpdateProfile, User } from "@shared/schema";
import { storage } from "../../storage";
import { writeAuditLog } from "../audit";
import { requireAdminOrSuper } from "../middleware";
import {
  BusinessStatusServiceError,
  listBusinessStatusRequestsForAdmin,
  moderateBusinessStatusRequest,
} from "../../users/business-status-service";
import { notifyBusinessStatusResult } from "../../notifications/create";

function adminUserJson(u: User) {
  const {
    password: _pw,
    phone: _ph,
    phoneCipher: _pc,
    phoneLookupHash: _lh,
    fcmToken: _fc,
    iosVoipToken: _voip,
    ...safe
  } = u as User & { password?: string };
  return safe;
}

type ReqWithAdmin = Request & { adminUserId: string; adminRole?: string };

function paramId(req: Request, name: string): string {
  const p = req.params[name];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

const ADMIN_BULK_USER_ACTION_CAP = 100;

function parseAdminUserListSort(
  rawSort: unknown,
  rawDir: unknown,
): { sort?: "createdAt" | "referrals" | "invitedBy"; sortDir?: "asc" | "desc" } {
  const sort =
    rawSort === "referrals" || rawSort === "invitedBy" || rawSort === "createdAt"
      ? rawSort
      : undefined;
  const sortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : undefined;
  return { sort, sortDir };
}

export function registerAdminUsersRoutes(app: Express): void {
  app.get("/api/admin/business-status-requests", requireAdminOrSuper, async (req: Request, res: Response) => {
    try {
      const payload = await listBusinessStatusRequestsForAdmin({
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json(payload);
    } catch (e) {
      if (e instanceof BusinessStatusServiceError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error("admin business-status list", e);
      res.status(500).json({ message: "Ошибка загрузки заявок" });
    }
  });

  app.post(
    "/api/admin/business-status-requests/:id/approve",
    requireAdminOrSuper,
    async (req: Request, res: Response) => {
      const adminUserId = (req as ReqWithAdmin).adminUserId;
      const requestId = paramId(req, "id");
      try {
        const result = await moderateBusinessStatusRequest({
          adminUserId,
          requestId,
          decision: "approved",
          adminComment: req.body?.adminComment,
        });
        await writeAuditLog({
          adminId: adminUserId,
          action: "business_status.approve",
          targetType: "business_status_request",
          targetId: requestId,
          details: { idempotent: result.idempotent, decision: "approved" },
          ip: req.ip,
        });
        void notifyBusinessStatusResult(
          result.request?.userId ?? "",
          adminUserId,
          "approved",
          result.request?.adminComment ?? null,
        );
        res.json({ ok: true, ...result });
      } catch (e) {
        if (e instanceof BusinessStatusServiceError) {
          res.status(e.status).json({ message: e.message });
          return;
        }
        console.error("admin business-status approve", e);
        res.status(500).json({ message: "Ошибка модерации заявки" });
      }
    },
  );

  app.post(
    "/api/admin/business-status-requests/:id/reject",
    requireAdminOrSuper,
    async (req: Request, res: Response) => {
      const adminUserId = (req as ReqWithAdmin).adminUserId;
      const requestId = paramId(req, "id");
      try {
        const result = await moderateBusinessStatusRequest({
          adminUserId,
          requestId,
          decision: "rejected",
          adminComment: req.body?.adminComment,
        });
        await writeAuditLog({
          adminId: adminUserId,
          action: "business_status.reject",
          targetType: "business_status_request",
          targetId: requestId,
          details: { idempotent: result.idempotent, decision: "rejected" },
          ip: req.ip,
        });
        void notifyBusinessStatusResult(
          result.request?.userId ?? "",
          adminUserId,
          "rejected",
          result.request?.adminComment ?? null,
        );
        res.json({ ok: true, ...result });
      } catch (e) {
        if (e instanceof BusinessStatusServiceError) {
          res.status(e.status).json({ message: e.message });
          return;
        }
        console.error("admin business-status reject", e);
        res.status(500).json({ message: "Ошибка модерации заявки" });
      }
    },
  );

  app.post(
    "/api/admin/business-status-requests/:id/revision",
    requireAdminOrSuper,
    async (req: Request, res: Response) => {
      const adminUserId = (req as ReqWithAdmin).adminUserId;
      const requestId = paramId(req, "id");
      try {
        const result = await moderateBusinessStatusRequest({
          adminUserId,
          requestId,
          decision: "revision_required",
          adminComment: req.body?.adminComment,
        });
        await writeAuditLog({
          adminId: adminUserId,
          action: "business_status.revision",
          targetType: "business_status_request",
          targetId: requestId,
          details: { idempotent: result.idempotent, decision: "revision_required" },
          ip: req.ip,
        });
        void notifyBusinessStatusResult(
          result.request?.userId ?? "",
          adminUserId,
          "revision_required",
          result.request?.adminComment ?? null,
        );
        res.json({ ok: true, ...result });
      } catch (e) {
        if (e instanceof BusinessStatusServiceError) {
          res.status(e.status).json({ message: e.message });
          return;
        }
        console.error("admin business-status revision", e);
        res.status(500).json({ message: "Ошибка модерации заявки" });
      }
    },
  );

  app.get("/api/admin/users", async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const includeDeleted = req.query.includeDeleted === "true";
    const { sort, sortDir } = parseAdminUserListSort(req.query.sort, req.query.sortDir);
    try {
      const result = await storage.listUsersForAdmin({
        limit,
        offset,
        search,
        includeDeleted,
        sort,
        sortDir,
      });
      const ids = result.users.map((u) => u.id);
      const [referralCounts, signupRiskById] = await Promise.all([
        storage.getReferralCountsForUserIds(ids),
        storage.getAdminUserSignupRiskSummaries(ids),
      ]);
      const inviterIds = [
        ...new Set(
          result.users.map((u) => u.invitedById).filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      ];
      const inviterBriefs = await storage.getUsersPublicBriefByIds(inviterIds);
      const usersWithReferrals = result.users.map((u) => {
        const inv = u.invitedById ? inviterBriefs[u.invitedById] ?? null : null;
        return {
          ...adminUserJson(u),
          referralCount: referralCounts[u.id] ?? 0,
          invitedByUser: inv,
          signupRisk: signupRiskById[u.id] ?? { level: "none", reasons: [], sameDeviceOthers: 0, sameIpUaOthers: 0 },
        };
      });
      res.json({ users: usersWithReferrals, total: result.total });
    } catch (e) {
      console.error("admin users list", e);
      res.status(500).json({ message: "Ошибка загрузки списка" });
    }
  });

  app.post("/api/admin/users/bulk-ban", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const raw = (req.body as { ids?: unknown; reason?: unknown })?.ids;
    const ids = Array.isArray(raw)
      ? [...new Set(raw.filter((x): x is string => typeof x === "string" && x.length > 0))]
      : [];
    if (ids.length === 0) {
      res.status(400).json({ message: "Укажите ids (массив строк)" });
      return;
    }
    if (ids.length > ADMIN_BULK_USER_ACTION_CAP) {
      res.status(400).json({ message: `Не более ${ADMIN_BULK_USER_ACTION_CAP} пользователей за раз` });
      return;
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    let affected = 0;
    try {
      for (const id of ids) {
        if (id === adminUserId) continue;
        const target = await storage.getUser(id);
        if (!target) continue;
        await storage.setUserBlocked(id, true, { bannedBy: adminUserId, banReason: reason });
        await writeAuditLog({
          adminId: adminUserId,
          action: "user.ban",
          targetType: "user",
          targetId: id,
          details: { reason, bulk: true },
          ip: req.ip,
        });
        affected += 1;
      }
      res.json({ ok: true, affected });
    } catch (e) {
      console.error("admin users bulk-ban", e);
      res.status(500).json({ message: "Ошибка массовой блокировки" });
    }
  });

  app.post("/api/admin/users/bulk-delete", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const raw = (req.body as { ids?: unknown })?.ids;
    const ids = Array.isArray(raw)
      ? [...new Set(raw.filter((x): x is string => typeof x === "string" && x.length > 0))]
      : [];
    if (ids.length === 0) {
      res.status(400).json({ message: "Укажите ids (массив строк)" });
      return;
    }
    if (ids.length > ADMIN_BULK_USER_ACTION_CAP) {
      res.status(400).json({ message: `Не более ${ADMIN_BULK_USER_ACTION_CAP} пользователей за раз` });
      return;
    }
    let affected = 0;
    try {
      for (const id of ids) {
        if (id === adminUserId) continue;
        const target = await storage.getUser(id);
        if (!target) continue;
        await storage.setUserDeleted(id, true);
        await writeAuditLog({
          adminId: adminUserId,
          action: "user.delete",
          targetType: "user",
          targetId: id,
          details: { bulk: true },
          ip: req.ip,
        });
        affected += 1;
      }
      res.json({ ok: true, affected });
    } catch (e) {
      console.error("admin users bulk-delete", e);
      res.status(500).json({ message: "Ошибка массового удаления" });
    }
  });

  app.get("/api/admin/users/:id/signup-related", async (req: Request, res: Response) => {
    const id = paramId(req, "id");
    const user = await storage.getUser(id);
    if (!user) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    try {
      const [rel, riskMap] = await Promise.all([
        storage.listUsersRelatedBySignupSignals(id, { limit }),
        storage.getAdminUserSignupRiskSummaries([id]),
      ]);
      const signupRisk = riskMap[id] ?? { level: "none", reasons: [], sameDeviceOthers: 0, sameIpUaOthers: 0 };
      res.json({
        user: { ...adminUserJson(user), signupRisk },
        related: {
          byDeviceId: rel.byDeviceId.map(adminUserJson),
          byIp: rel.byIp.map(adminUserJson),
          byUaHash: rel.byUaHash.map(adminUserJson),
          byClientSignalsHash: rel.byClientSignalsHash.map(adminUserJson),
        },
        hint:
          "Один Wi‑Fi даёт общий IP (мама/папа/сын). Серия аккаунтов с одного устройства сильнее коррелирует с byDeviceId и byClientSignalsHash.",
      });
    } catch (e) {
      console.error("admin signup-related", e);
      res.status(500).json({ message: "Ошибка загрузки связанных регистраций" });
    }
  });

  app.get("/api/admin/users/:id", async (req: Request, res: Response) => {
    const id = paramId(req, "id");
    const user = await storage.getUser(id);
    if (!user) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    res.json(adminUserJson(user));
  });

  app.patch("/api/admin/users/:id", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const adminRole = (req as ReqWithAdmin).adminRole ?? "user";
    const id = paramId(req, "id");
    const target = await storage.getUser(id);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    const auditFields: string[] = [];
    const auditExtra: Record<string, unknown> = {};
    let updated = target;

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "publicId")) {
      if (adminRole !== "admin" && adminRole !== "super_admin") {
        res.status(403).json({
          message: "Смена публичного ID доступна только ролям admin и super_admin",
        });
        return;
      }
      const raw = (req.body as { publicId?: unknown }).publicId;
      const n = typeof raw === "number" && Number.isInteger(raw) ? raw : Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        res.status(400).json({ message: "Укажите целый публичный ID больше нуля" });
        return;
      }
      const pr = await storage.adminSetUserPublicId(id, n);
      if (!pr.ok) {
        if (pr.reason === "taken") {
          res.status(409).json({ message: "Этот публичный ID уже занят другим пользователем" });
          return;
        }
        if (pr.reason === "invalid") {
          res.status(400).json({ message: "Некорректный публичный ID (диапазон 1…2147483647)" });
          return;
        }
        res.status(404).json({ message: "Пользователь не найден" });
        return;
      }
      updated = pr.user;
      auditFields.push("publicId");
      auditExtra.publicIdNew = n;
    }

    const updatableFields = [
      "displayName",
      "surname",
      "gender",
      "birthDate",
      "bio",
      "city",
      "status",
      "profileVisibility",
      "showOnlineTo",
      "referralLimit",
    ] as const;
    const data: Record<string, unknown> = {};
    for (const key of updatableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, key)) {
        (data as Record<string, unknown>)[key] = (req.body as Record<string, unknown>)[key];
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "boardApiHubPrimeCode")) {
      const v = (req.body as { boardApiHubPrimeCode?: unknown }).boardApiHubPrimeCode;
      if (v === null) {
        data.boardApiHubPrimeCode = null;
      } else if (typeof v === "string") {
        const t = v.trim();
        data.boardApiHubPrimeCode = t.length === 0 ? null : t.slice(0, 64);
      } else {
        res.status(400).json({ message: "Некорректный PRIME CODE" });
        return;
      }
    }
    try {
      if (Object.keys(data).length > 0) {
        const u = await storage.updateUserProfile(id, data as UpdateProfile);
        if (!u) {
          res.status(500).json({ message: "Не удалось обновить профиль" });
          return;
        }
        updated = u;
        auditFields.push(...Object.keys(data));
      }
      if (auditFields.length === 0) {
        res.status(400).json({ message: "Нет полей для обновления" });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "user.update",
        targetType: "user",
        targetId: id,
        details: { fields: auditFields, ...auditExtra },
        ip: req.ip,
      });
      res.json(adminUserJson(updated));
    } catch (e) {
      console.error("admin user update", e);
      res.status(500).json({ message: "Ошибка обновления профиля" });
    }
  });

  app.post("/api/admin/users/:id/ban", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = paramId(req, "id");
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const target = await storage.getUser(id);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.setUserBlocked(id, true, { bannedBy: adminUserId, banReason: reason });
    await writeAuditLog({
      adminId: adminUserId,
      action: "user.ban",
      targetType: "user",
      targetId: id,
      details: { reason },
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/users/:id/unban", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = paramId(req, "id");
    const target = await storage.getUser(id);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.setUserBlocked(id, false);
    await writeAuditLog({
      adminId: adminUserId,
      action: "user.unban",
      targetType: "user",
      targetId: id,
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = paramId(req, "id");
    if (id === adminUserId) {
      res.status(400).json({ message: "Нельзя удалить самого себя" });
      return;
    }
    const target = await storage.getUser(id);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.setUserDeleted(id, true);
    await writeAuditLog({
      adminId: adminUserId,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  /**
   * Блокировка по смыслу + безвозвратное удаление строки пользователя и связанных данных (каскад БД).
   * Только роли admin / super_admin. Требуется confirmPublicId, чтобы снизить риск ошибки.
   */
  app.post("/api/admin/users/:id/ban-and-purge", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const adminRole = (req as ReqWithAdmin).adminRole ?? "user";
    if (adminRole !== "admin" && adminRole !== "super_admin") {
      res.status(403).json({
        message: "Полное удаление из системы доступно только ролям admin и super_admin",
      });
      return;
    }
    const id = paramId(req, "id");
    if (id === adminUserId) {
      res.status(400).json({ message: "Нельзя удалить самого себя" });
      return;
    }
    const rawConfirm = (req.body as { confirmPublicId?: unknown })?.confirmPublicId;
    const confirmPublicId = typeof rawConfirm === "number" ? rawConfirm : Number(rawConfirm);
    if (!Number.isFinite(confirmPublicId)) {
      res.status(400).json({
        message: "Укажите confirmPublicId (публичный ID пользователя) для подтверждения",
      });
      return;
    }
    const target = await storage.getUser(id);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    if (target.publicId !== confirmPublicId) {
      res.status(400).json({ message: "Подтверждение не совпадает: неверный публичный ID" });
      return;
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    try {
      const ok = await storage.purgeUserPermanently(id);
      if (!ok) {
        res.status(404).json({ message: "Пользователь не найден" });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "user.ban_and_purge",
        targetType: "user",
        targetId: id,
        details: { reason: reason ?? null, publicId: target.publicId },
        ip: req.ip,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("admin ban-and-purge", e);
      const err = e as { code?: string; detail?: string; constraint?: string };
      const isFk = err.code === "23503";
      res.status(500).json({
        message: isFk
          ? "Удаление из БД заблокировано внешним ключом (остались связанные строки). Сообщите разработчикам имя ограничения из логов сервера."
          : "Не удалось полностью удалить пользователя. Проверьте логи сервера.",
        ...(process.env.NODE_ENV !== "production" && (err.detail || err.constraint)
          ? { detail: err.detail, constraint: err.constraint }
          : {}),
      });
    }
  });
}
