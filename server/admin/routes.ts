import type { Express } from "express";
import { requireAdmin } from "./middleware";
import type { Request, Response } from "express";
import { getUserId } from "../auth/session";
import { storage } from "../storage";
import { verifyPassword } from "../auth/password";
import { normalizePhone } from "../auth/phone";
import { registerAdminDashboardRoutes } from "./dashboard/routes";
import { registerAdminUsersRoutes } from "./users/routes";
import { registerAdminAdminsRoutes } from "./admins/routes";
import { registerAdminAuditRoutes } from "./audit/routes";
import { registerAdminFeedRoutes } from "./feed/routes";
import { registerAdminReferralRoutes } from "./referrals/routes";
import { registerAdminContentIngestRoutes } from "./content-ingest/routes";
import { registerAdminVkParserRoutes } from "./vk-parser/routes";
import { registerOpsPlatformAdminRoutes } from "./ops/platform.admin-http";
import { registerOpsContentRemoveAdminRoutes } from "./ops/content-remove/content-remove.admin-http/content-remove.admin-http";
import { registerOpsReportsAdminRoutes } from "./ops/reports.admin-http";
import { registerOpsTrafficShieldAdminRoutes } from "./ops/traffic-shield.admin-http";
import { registerOpsDiskAdminRoutes } from "./ops/disk.admin-http";
import { registerAdminModulesTelemetryRoutes } from "./telemetry/modules.admin-http";
import { registerAdminEdgePrizeRoutes } from "./edge-prize.routes";
import { registerAdminEdgeCompanionRoutes } from "./edge-companion-admin.routes";
import { registerAdminHelpPagesRoutes } from "./help-pages/routes";
import { registerAdminMediaStudioRoutes } from "./media-studio/routes";
import { registerAdminGroupChatsRoutes } from "./group-chats/routes";
import { registerAdminNavBadgeRoutes } from "./nav-badges.routes";
import { registerAdminNewTelCallPasswordLogRoutes } from "./new-tel-call-password-log.admin-http";

const ADMIN_ROLES = ["moderator", "admin", "super_admin"] as const;

function hasAdminRole(role: string | null | undefined): boolean {
  const normalized = role ?? "user";
  return ADMIN_ROLES.includes(normalized as (typeof ADMIN_ROLES)[number]);
}

function normalizeAdminLogin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.toLowerCase() === "admin") return "admin";
  return normalizePhone(v);
}

function registerAdminAuthCompatRoutes(app: Express): void {
  app.post("/api/admin/login", async (req: Request, res: Response) => {
    const login = normalizeAdminLogin((req.body as { login?: unknown } | undefined)?.login);
    const password = (req.body as { password?: unknown } | undefined)?.password;
    if (!login) {
      res.status(400).json({ message: "Укажите логин или номер телефона" });
      return;
    }
    if (typeof password !== "string" || password.length === 0) {
      res.status(400).json({ message: "Введите пароль" });
      return;
    }
    try {
      const user = await storage.getUserByPhone(login);
      if (!user) {
        res.status(401).json({ message: "Неверный логин или пароль" });
        return;
      }
      if (!verifyPassword(password, user.password ?? "")) {
        res.status(401).json({ message: "Неверный логин или пароль" });
        return;
      }
      if (!hasAdminRole(user.platformRole ?? "user")) {
        res.status(403).json({ message: "Доступ только для администраторов" });
        return;
      }
      if (!req.session) {
        res.status(500).json({ message: "Сессия недоступна" });
        return;
      }
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          res.status(500).json({ message: "Ошибка сохранения сессии" });
          return;
        }
        res.json({ ok: true });
      });
    } catch {
      res.status(500).json({ message: "Ошибка входа" });
    }
  });

  app.get("/api/admin/me", async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !hasAdminRole(user.platformRole ?? "user")) {
        res.status(403).json({ message: "Доступ только для администраторов" });
        return;
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Ошибка проверки доступа" });
    }
  });

  app.post("/api/admin/logout", (req: Request, res: Response) => {
    req.session?.destroy(() => {});
    res.json({ ok: true });
  });
}

export function registerAdminRoutes(app: Express): void {
  registerAdminAuthCompatRoutes(app);
  app.use("/api/admin", requireAdmin);
  registerAdminDashboardRoutes(app);
  registerAdminUsersRoutes(app);
  registerAdminAdminsRoutes(app);
  registerAdminAuditRoutes(app);
  registerOpsPlatformAdminRoutes(app);
  registerOpsReportsAdminRoutes(app);
  registerOpsContentRemoveAdminRoutes(app);
  registerOpsTrafficShieldAdminRoutes(app);
  registerOpsDiskAdminRoutes(app);
  registerAdminModulesTelemetryRoutes(app);
  registerAdminFeedRoutes(app);
  registerAdminReferralRoutes(app);
  registerAdminHelpPagesRoutes(app);
  registerAdminContentIngestRoutes(app);
  registerAdminVkParserRoutes(app);
  registerAdminEdgePrizeRoutes(app);
  registerAdminEdgeCompanionRoutes(app);
  registerAdminMediaStudioRoutes(app);
  registerAdminGroupChatsRoutes(app);
  registerAdminNavBadgeRoutes(app);
  registerAdminNewTelCallPasswordLogRoutes(app);
}
