import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import { requireAdmin } from "../admin/middleware";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import {
  getThreadByChatForUser,
  listServiceChatAdminState,
  listServiceTemplates,
  replaceActiveTemplate,
  runServiceCampaign,
  ServiceChatError,
  setLocalRepliesByChat,
  upsertServiceHostConfig,
} from "./service";

function handleError(res: Response, error: unknown): void {
  if (error instanceof ServiceChatError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  throw error;
}

export function registerServiceChatRoutes(app: Express): void {
  app.get("/api/service-chat/admin/state", noStorePrivateJson, requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const hosts = await listServiceChatAdminState();
      res.json({ hosts });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/service-chat/admin/host", noStorePrivateJson, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const hostUserId = typeof req.body?.hostUserId === "string" ? req.body.hostUserId.trim() : "";
    const enabled = req.body?.enabled === true;
    const globalRepliesAllowed = req.body?.globalRepliesAllowed === true;
    if (!hostUserId) {
      res.status(400).json({ message: "hostUserId обязателен" });
      return;
    }
    try {
      const host = await upsertServiceHostConfig({ hostUserId, enabled, globalRepliesAllowed });
      res.json(host);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/service-chat/admin/templates/:hostUserId", noStorePrivateJson, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const hostUserId = String(req.params.hostUserId || "");
    try {
      const templates = await listServiceTemplates(hostUserId);
      res.json({ templates });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/service-chat/admin/templates/:hostUserId", noStorePrivateJson, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const hostUserId = String(req.params.hostUserId || "");
    const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : "Приветственная цепочка";
    const rawSteps: unknown[] = Array.isArray(req.body?.steps) ? req.body.steps : [];
    const steps: Array<{ content: string; delayAfterReadSec: number; mediaJson: string | null }> = [];
    for (const item of rawSteps) {
      const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const content = typeof row.content === "string" ? row.content.trim() : "";
      const mediaJson = typeof row.mediaJson === "string" ? row.mediaJson : null;
      const hasMedia = !!mediaJson && mediaJson.trim().length > 0;
      if (!content && !hasMedia) continue;
      steps.push({
        content,
        delayAfterReadSec: Number(row.delayAfterReadSec) || 0,
        mediaJson,
      });
    }
    try {
      const template = await replaceActiveTemplate(hostUserId, name, steps);
      res.status(201).json({ template });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/service-chat/admin/campaigns", noStorePrivateJson, requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const hostUserId = typeof req.body?.hostUserId === "string" ? req.body.hostUserId.trim() : "";
    const modeRaw = typeof req.body?.mode === "string" ? req.body.mode : "all";
    const mode = modeRaw === "selected" || modeRaw === "personal" ? modeRaw : "all";
    const targetUserIds = Array.isArray(req.body?.targetUserIds) ? req.body.targetUserIds.map((v: unknown) => String(v)) : [];
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const mediaJson = typeof req.body?.mediaJson === "string" ? req.body.mediaJson : null;
    if (!hostUserId) {
      res.status(400).json({ message: "hostUserId обязателен" });
      return;
    }
    try {
      const result = await runServiceCampaign({ hostUserId, mode, targetUserIds, content, mediaJson });
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/service-chat/chats/:chatId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = String(req.params.chatId || "");
    try {
      const thread = await getThreadByChatForUser(userId, chatId);
      res.json({ thread });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.patch("/api/service-chat/chats/:chatId/local-replies", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = String(req.params.chatId || "");
    const enabled = req.body?.enabled === true;
    try {
      const data = await setLocalRepliesByChat(userId, chatId, enabled);
      res.json(data);
    } catch (error) {
      handleError(res, error);
    }
  });
}
