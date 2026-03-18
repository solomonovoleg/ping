import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { writeAuditLog } from "../audit";
import type { PlatformRole } from "@shared/schema";

type ReqWithAdmin = Request & { adminUserId: string };

function paramId(req: Request, name: string): string {
  const p = req.params[name];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

const PLATFORM_ROLES: PlatformRole[] = ["user", "moderator", "admin", "super_admin"];

export function registerAdminAdminsRoutes(app: Express): void {
  app.get("/api/admin/admins", async (_req: Request, res: Response) => {
    try {
      const list = await storage.listAdmins();
      res.json(list);
    } catch (e) {
      console.error("admin admins list", e);
      res.status(500).json({ message: "Ошибка загрузки списка админов" });
    }
  });

  app.patch("/api/admin/admins/:id/role", async (req: Request, res: Response) => {
    const adminUserId = (req as ReqWithAdmin).adminUserId;
    const currentAdmin = await storage.getUser(adminUserId);
    const role = typeof req.body?.role === "string" ? req.body.role : undefined;
    if (!role || !PLATFORM_ROLES.includes(role as PlatformRole)) {
      res.status(400).json({ message: "Недопустимая роль" });
      return;
    }
    const targetId = paramId(req, "id");
    if (targetId === adminUserId && role !== "super_admin" && currentAdmin?.platformRole === "super_admin") {
      res.status(400).json({ message: "Супер-админ не может понизить сам себя" });
      return;
    }
    const target = await storage.getUser(targetId);
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.setPlatformRole(targetId, role);
    await writeAuditLog({
      adminId: adminUserId,
      action: "user.role",
      targetType: "user",
      targetId,
      details: { previousRole: target.platformRole, newRole: role },
      ip: req.ip,
    });
    res.json({ ok: true, role });
  });
}
