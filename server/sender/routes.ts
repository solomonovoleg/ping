import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { getSenderWelcomeForUser, patchSenderWelcome } from "./service";

export function registerSenderRoutes(app: Express): void {
  app.get("/api/sender/welcome", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ message: "SENDER недоступен без базы данных" });
      return;
    }
    try {
      const payload = await getSenderWelcomeForUser(userId);
      res.json(payload);
    } catch (e) {
      console.error("[sender] GET welcome:", e);
      res.status(500).json({ message: "Не удалось загрузить настройки SENDER" });
    }
  });

  app.patch("/api/sender/welcome", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ message: "SENDER недоступен без базы данных" });
      return;
    }
    const body = req.body ?? {};
    const patch: {
      moduleEnabled?: boolean;
      autoSendOnFollow?: boolean;
      welcomeText?: string;
      welcomeMediaUrl?: string | null;
    } = {};
    if (typeof body.moduleEnabled === "boolean") patch.moduleEnabled = body.moduleEnabled;
    if (typeof body.autoSendOnFollow === "boolean") patch.autoSendOnFollow = body.autoSendOnFollow;
    if (typeof body.welcomeText === "string") patch.welcomeText = body.welcomeText;
    if (body.welcomeMediaUrl === null) patch.welcomeMediaUrl = null;
    else if (typeof body.welcomeMediaUrl === "string") patch.welcomeMediaUrl = body.welcomeMediaUrl;
    try {
      const payload = await patchSenderWelcome(userId, patch);
      res.json(payload);
    } catch (e) {
      const status = typeof e === "object" && e !== null && "status" in e && typeof (e as { status: unknown }).status === "number"
        ? (e as { status: number }).status
        : 500;
      const msg = e instanceof Error ? e.message : "Не удалось сохранить";
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: msg });
        return;
      }
      console.error("[sender] PATCH welcome:", e);
      res.status(500).json({ message: msg });
    }
  });
}
