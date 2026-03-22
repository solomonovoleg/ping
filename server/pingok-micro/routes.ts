import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { parsePingokCommandHeuristic } from "@shared/pingok-micro/parse-heuristic";
import type { PingokMicroParseRequest } from "@shared/pingok-micro/command-types";
import {
  looksLikeGlobalMemorySearchIntent,
  tryGlobalMemorySearch,
} from "../ai-chat/memory-search";
import { executePingokCommand, sendDmToUser, startCallWithUser } from "./execute-service";

/**
 * ПИНГОК МИКРО: разбор голосовой команды на том же origin, что и приложение (сессия + Bearer).
 */
export function registerPingokMicroRoutes(app: Express): void {
  app.post("/api/pingok-micro/v1/parse", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    const body = req.body as PingokMicroParseRequest | undefined;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      res.status(400).json({ error: "text required" });
      return;
    }
    const parsed = parsePingokCommandHeuristic({ text });
    res.json(parsed);
  });

  /**
   * Исполнение: напоминание / задача / сообщение (после parse на клиенте передаётся тот же текст).
   */
  app.post("/api/pingok-micro/v1/execute", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      res.status(400).json({ error: "text required" });
      return;
    }
    const parsed = parsePingokCommandHeuristic({ text });
    try {
      const result = await executePingokCommand(userId, parsed);
      res.json(result);
    } catch (e) {
      console.error("[pingok-micro] execute", e);
      res.status(500).json({ ok: false, reply: "Ошибка исполнения команды" });
    }
  });

  /** Выбор получателя после execute с code pick_user */
  app.post("/api/pingok-micro/v1/send-dm", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    const targetUserId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId.trim() : "";
    const messageText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!targetUserId || !messageText) {
      res.status(400).json({ error: "targetUserId and text required" });
      return;
    }
    try {
      const result = await sendDmToUser(userId, targetUserId, messageText);
      res.json(result);
    } catch (e) {
      console.error("[pingok-micro] send-dm", e);
      res.status(500).json({ ok: false, reply: "Ошибка отправки" });
    }
  });

  app.post("/api/pingok-micro/v1/start-call", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    const targetUserId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId.trim() : "";
    const modeRaw = typeof req.body?.mode === "string" ? req.body.mode.trim().toLowerCase() : "";
    const mode: "audio" | "video" = modeRaw === "video" ? "video" : "audio";
    if (!targetUserId) {
      res.status(400).json({ error: "targetUserId required" });
      return;
    }
    try {
      const result = await startCallWithUser(userId, targetUserId, mode);
      res.json(result);
    } catch (e) {
      console.error("[pingok-micro] start-call", e);
      res.status(500).json({ ok: false, reply: "Ошибка запуска звонка" });
    }
  });

  /**
   * Поиск по перепискам (тот же движок, что AI-чат), без записи в историю ассистента.
   */
  app.post("/api/pingok-micro/v1/memory-search", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Необходимо войти в аккаунт" });
      return;
    }
    let query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) {
      res.status(400).json({ message: "query required" });
      return;
    }
    try {
      if (!looksLikeGlobalMemorySearchIntent(query)) {
        query = `найди в сообщениях ${query}`;
      }
      const result = await tryGlobalMemorySearch(userId, query);
      if (!result) {
        res.json({
          matched: false,
          hint: "Запрос не подошёл под поиск по чатам. Скажите подробнее, например: «где я писал про врача».",
        });
        return;
      }
      res.json({
        matched: true,
        summary: result.summary,
        payload: result.payload,
      });
    } catch (e) {
      console.error("[pingok-micro] memory-search", e);
      res.status(500).json({ message: "Ошибка поиска по перепискам" });
    }
  });
}
