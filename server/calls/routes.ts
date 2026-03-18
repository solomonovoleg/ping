import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { createCallToken } from "./token";
import { listMissedCallsForUser } from "./missed";

export function registerCallRoutes(app: Express): void {
  app.post("/api/calls/token", requireAuth, (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const token = createCallToken(userId);
      res.json({ token });
    } catch (err) {
      console.error("[calls/token]", err);
      res.status(503).json({ message: "Сервис звонков временно недоступен" });
    }
  });

  /** Список пропущенных звонков для текущего пользователя */
  app.get("/api/calls/missed", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const list = await listMissedCallsForUser(userId);
    res.json(
      list.map((m) => ({
        id: m.id,
        chatId: m.chatId,
        callerId: m.callerId,
        video: m.video,
        createdAt: m.createdAt?.toISOString?.() ?? new Date().toISOString(),
        callerDisplayName: m.callerDisplayName ?? null,
        callerSurname: m.callerSurname ?? null,
        callerAvatarUrl: m.callerAvatarUrl ?? null,
      }))
    );
  });
}
