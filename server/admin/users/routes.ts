import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { writeAuditLog } from "../audit";

type ReqWithAdmin = Request & { adminUserId: string };

function paramId(req: Request, name: string): string {
  const p = req.params[name];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

export function registerAdminUsersRoutes(app: Express): void {
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const includeDeleted = req.query.includeDeleted === "true";
    try {
      const result = await storage.listUsersForAdmin({ limit, offset, search, includeDeleted });
      const referralCounts = await storage.getReferralCountsForUserIds(result.users.map((u) => u.id));
      const usersWithReferrals = result.users.map((u) => ({
        ...u,
        referralCount: referralCounts[u.id] ?? 0,
      }));
      res.json({ users: usersWithReferrals, total: result.total });
    } catch (e) {
      console.error("admin users list", e);
      res.status(500).json({ message: "Ошибка загрузки списка" });
    }
  });

  app.get("/api/admin/users/:id", async (req: Request, res: Response) => {
    const id = paramId(req, "id");
    const user = await storage.getUser(id);
    if (!user) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    const { password: _p, ...safe } = user;
    res.json(safe);
  });

  app.patch("/api/admin/users/:id", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const id = paramId(req, "id");
    const target = await storage.getUser(id);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
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
        (data as any)[key] = (req.body as any)[key];
      }
    }
    try {
      const updated = await storage.updateUserProfile(id, data as any);
      if (!updated) {
        res.status(500).json({ message: "Не удалось обновить профиль" });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "user.update",
        targetType: "user",
        targetId: id,
        details: { fields: Object.keys(data) },
        ip: req.ip,
      });
      const { password: _p, ...safe } = updated;
      res.json(safe);
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
}
