import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import { getActiveHotSignals } from "./hot-signals";
import { ingestChat } from "./ingest";
import { listTopInterests, searchIndexed } from "./repo";

export function registerAiSearchRoutes(app: Express): void {
  app.get("/api/ai-search", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      res.status(400).json({ message: "Запрос не короче 2 символов" });
      return;
    }
    try {
      const lim = Math.min(Number(req.query.limit) || 20, 50);
      const { tags, interests } = await searchIndexed(userId, q, lim);
      res.json({
        query: q,
        tags,
        interests,
        hint: "Индекс строится из ваших чатов небольшими порциями; ищите по темам и интересам.",
      });
    } catch (e) {
      console.error("[ai-search] query", e);
      res.status(500).json({ message: "Ошибка поиска" });
    }
  });

  /** Горячие темы под мгновенный таргетинг (L1 + Postgres, TTL). */
  app.get("/api/ai-search/hot", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const lim = Math.min(Number(req.query.limit) || 16, 30);
      const hot = await getActiveHotSignals(userId, lim);
      res.json({
        hot: hot.map((r) => ({
          key: r.signal_key,
          label: r.label_display,
          snippet: r.snippet,
          chat_id: r.source_chat_id,
          score: r.score,
          last_at: r.last_at,
          expires_at: r.expires_at,
        })),
      });
    } catch (e) {
      console.error("[ai-search] hot", e);
      res.status(500).json({ message: "Ошибка горячих тем" });
    }
  });

  /** Долгосрочные интересы + горячие сигналы одним запросом (рекламный контекст). */
  app.get("/api/ai-search/ad-context", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const limH = Math.min(Number(req.query.limitHot) || 12, 24);
      const limC = Math.min(Number(req.query.limitCommercial) || 15, 40);
      const limB = Math.min(Number(req.query.limitBehavioral) || 15, 40);
      const [hot, commercial, behavioral] = await Promise.all([
        getActiveHotSignals(userId, limH),
        listTopInterests(userId, "commercial", limC),
        listTopInterests(userId, "behavioral", limB),
      ]);
      res.json({
        hot: hot.map((r) => ({
          key: r.signal_key,
          label: r.label_display,
          snippet: r.snippet,
          chat_id: r.source_chat_id,
          score: r.score,
          expires_at: r.expires_at,
        })),
        commercial,
        behavioral,
      });
    } catch (e) {
      console.error("[ai-search] ad-context", e);
      res.status(500).json({ message: "Ошибка контекста" });
    }
  });

  app.post("/api/ai-search/ingest-chat", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";
    if (!chatId) {
      res.status(400).json({ message: "Укажите chatId" });
      return;
    }
    try {
      await ingestChat(userId, chatId);
      res.json({ ok: true });
    } catch (e) {
      console.error("[ai-search] manual ingest", e);
      res.status(500).json({ message: "Не удалось проиндексировать чат" });
    }
  });
}
