import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import {
  autoConnectBusinessWidgetForUser,
  BusinessChatError,
  handleBusinessInboundWebhook,
  invokeBusinessActionFromChat,
  listBusinessActionsForChat,
  listBusinessWidgetsForUser,
  processDueBusinessOutboundQueue,
} from "./service";

function handleBusinessError(res: Response, error: unknown): void {
  if (error instanceof BusinessChatError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error("[business-chat] route error:", error);
  res.status(500).json({ message: "Ошибка BUSINESS чата" });
}

export function registerBusinessChatRoutes(app: Express): void {
  if (process.env.DATABASE_URL) {
    const timer = setInterval(() => {
      void processDueBusinessOutboundQueue().catch((err) => {
        console.error("[business-chat] outbound queue tick failed", err instanceof Error ? err.message : String(err));
      });
    }, 10_000);
    timer.unref?.();
  }

  app.get("/api/business-chat/widgets", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ message: "BUSINESS чат недоступен без базы данных" });
      return;
    }
    try {
      const rows = await listBusinessWidgetsForUser(userId);
      res.json(rows);
    } catch (error) {
      handleBusinessError(res, error);
    }
  });

  app.post("/api/business-chat/widgets/autoconnect", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ message: "BUSINESS чат недоступен без базы данных" });
      return;
    }
    const body = req.body ?? {};
    try {
      const payload = await autoConnectBusinessWidgetForUser(userId, {
        name: typeof body.name === "string" ? body.name : "",
        endpointUrl: typeof body.endpointUrl === "string" ? body.endpointUrl : "",
        apiKey: typeof body.apiKey === "string" ? body.apiKey : "",
        providerType: typeof body.providerType === "string" ? body.providerType : "custom",
        contractUrl: typeof body.contractUrl === "string" ? body.contractUrl : null,
      });
      res.status(201).json(payload);
    } catch (error) {
      handleBusinessError(res, error);
    }
  });

  app.get("/api/business-chat/chats/:chatId/actions", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = String(req.params.chatId || "");
    try {
      const actions = await listBusinessActionsForChat(userId, chatId);
      res.json(actions);
    } catch (error) {
      handleBusinessError(res, error);
    }
  });

  app.post("/api/business-chat/chats/:chatId/actions/:actionId/invoke", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = String(req.params.chatId || "");
    const actionId = String(req.params.actionId || "");
    const input = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : null;
    try {
      const payload = await invokeBusinessActionFromChat(userId, chatId, actionId, input);
      res.json(payload);
    } catch (error) {
      handleBusinessError(res, error);
    }
  });

  app.post("/api/business-chat/webhook/:widgetId", async (req: Request, res: Response) => {
    const widgetId = String(req.params.widgetId || "");
    const timestamp = String(req.header("x-business-timestamp") || "");
    const signature = String(req.header("x-business-signature") || "");
    const rawBodyText = JSON.stringify(req.body ?? {});
    try {
      const payload = await handleBusinessInboundWebhook({
        widgetId,
        rawBody: req.body ?? {},
        rawBodyText,
        signature,
        timestamp,
      });
      res.json(payload);
    } catch (error) {
      handleBusinessError(res, error);
    }
  });
}
