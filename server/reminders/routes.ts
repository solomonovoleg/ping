import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { storage } from "../storage";
import { noStorePrivateJson } from "../middleware/no-store-private-json";

export function registerRemindersRoutes(app: Express): void {
  app.get("/api/reminders/due", requireAuth, noStorePrivateJson, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    try {
      const before = new Date();
      const rows = await storage.listDueUserReminders(userId, before);
      res.json({
        reminders: rows.map((r) => ({
          id: r.id,
          title: r.title,
          fireAt: r.fireAt.toISOString(),
        })),
      });
    } catch (e) {
      console.error("[reminders] due", e);
      res.status(500).json({ message: "Не удалось загрузить напоминания" });
    }
  });

  app.post("/api/reminders/:id/dismiss", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ message: "id required" });
      return;
    }
    try {
      const ok = await storage.dismissUserReminder(userId, id);
      if (!ok) {
        res.status(404).json({ message: "Напоминание не найдено" });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[reminders] dismiss", e);
      res.status(500).json({ message: "Ошибка" });
    }
  });
}
