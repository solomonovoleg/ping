import type { Express, Request, Response } from "express";

/**
 * Минимальные маршруты EDGE на платформе.
 * Когда подключите отдельный EDGE-сервис — добавьте прокси (см. документацию репозитория).
 */
export function registerEdgeRoutes(app: Express): void {
  app.get("/api/edge/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "ping-moot-platform",
      /** true, если настроен URL бэкенда companion и проксируются маршруты */
      companionBackend: false,
    });
  });

  /**
   * Конфиг кампании для экрана Companion.
   * Пока внешний EDGE не проксируется — отдаём валидный JSON-заглушку (`isStub: true`), чтобы UIX был проверяемым.
   */
  app.get("/api/edge/companion/campaign-config", (req: Request, res: Response) => {
    const edgeId = String(req.query.edgeId ?? "").trim();
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    res.json({
      status: "published" as const,
      title: "Интерактивная кампания",
      gifts: { templates: [] as unknown[] },
      leaderboard: { globalEnabled: false },
      followReward: { enabled: false },
      isStub: true,
      edgeId,
    });
  });
}
