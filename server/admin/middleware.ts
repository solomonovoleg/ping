import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

const ADMIN_ROLES = ["moderator", "admin", "super_admin"] as const;

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await storage.getUser(userId);
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const role = user.platformRole ?? "user";
  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    res.status(403).json({ message: "Доступ только для администраторов" });
    return;
  }
  (req as Request & { adminUserId: string; adminRole: string }).adminUserId = userId;
  (req as Request & { adminUserId: string; adminRole: string }).adminRole = role;
  next();
}

/** Только admin и super_admin (не moderator) */
export async function requireAdminOrSuper(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await storage.getUser(userId);
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const role = user.platformRole ?? "user";
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({ message: "Недостаточно прав" });
    return;
  }
  (req as Request & { adminUserId: string; adminRole: string }).adminUserId = userId;
  (req as Request & { adminRole: string }).adminRole = role;
  next();
}

/** Только super_admin */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await storage.getUser(userId);
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (user.platformRole !== "super_admin") {
    res.status(403).json({ message: "Только супер-админ" });
    return;
  }
  (req as Request & { adminUserId: string }).adminUserId = userId;
  next();
}
