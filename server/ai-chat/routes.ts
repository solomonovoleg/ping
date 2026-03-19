import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { listAiMessages, MAX_MESSAGES_PAGE, proofreadText, sendAiMessage } from "./service";

export function registerAiChatRoutes(app: Express): void {
  app.get("/api/ai-chat/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, MAX_MESSAGES_PAGE);
    const before = typeof req.query.before === "string" ? req.query.before.trim() || null : null;
    try {
      const rows = await listAiMessages(userId, limit, before);
      res.json(rows);
    } catch (e) {
      console.error("[ai-chat] get messages:", e);
      res.status(500).json({ message: "Не удалось загрузить историю" });
    }
  });

  app.post("/api/ai-chat/proofread", requireAuth, async (req: Request, res: Response) => {
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      res.status(400).json({ message: "Укажите текст для проверки" });
      return;
    }
    if (content.length > 9000) {
      res.status(400).json({ message: "Текст слишком длинный для проверки" });
      return;
    }
    try {
      const text = await proofreadText(content);
      res.json({ text });
    } catch (e) {
      console.error("[ai-chat] proofread:", e);
      res.status(500).json({ message: e instanceof Error ? e.message : "Ошибка проверки текста" });
    }
  });

  app.post("/api/ai-chat/send", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      res.status(400).json({ message: "Укажите текст сообщения" });
      return;
    }
    try {
      const payload = await sendAiMessage(userId, content);
      res.status(201).json(payload);
    } catch (e) {
      console.error("[ai-chat] send:", e);
      res.status(500).json({ message: e instanceof Error ? e.message : "Ошибка при обращении к ИИ" });
    }
  });
}
