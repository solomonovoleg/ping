import type { Express, Request, Response } from "express";
import { dmByPublicIdLimiter } from "../auth/rate-limit";
import { requireAuth, getUserId } from "../auth/session";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import {
  createChatForUser,
  getChatByIdForUser,
  getChatByShortCodeForUser,
  getChatLinksForUser,
  getChatMediaForUser,
  getDmByPublicId,
  listChatsForUser,
  markChatRead,
  searchMessagesForUser,
} from "./service";
import { consumeComposerPulseForChat, listUnconsumedPulsesForUser } from "./composer-pulse-service";
import { getUserChatListShelvesForUser } from "./user-chat-list-shelves-service";
import { chatRouteParam as param, respondChatsServiceError } from "./chats-route-helpers";

export function registerChatsReadRoutes(app: Express): void {
  app.get("/api/chats", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const hiddenRaw = req.query.hidden;
    const hiddenOnly = hiddenRaw === "1" || hiddenRaw === "true";
    const chats = await listChatsForUser(userId, { hiddenOnly });
    res.json(chats);
  });

  app.get(
    "/api/chats/dm-by-public-id/:publicId",
    noStorePrivateJson,
    requireAuth,
    dmByPublicIdLimiter,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const publicIdNum = parseInt(param(req.params, "publicId"), 10);
      const messagesLimit = req.query.limit != null ? Math.min(Number(req.query.limit), 200) : 0;
      try {
        const payload = await getDmByPublicId(userId, publicIdNum, messagesLimit);
        return res.json(payload);
      } catch (error) {
        if (respondChatsServiceError(res, error)) return;
        throw error;
      }
    },
  );

  app.get(
    "/api/chats/by-code/:code",
    noStorePrivateJson,
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const code = param(req.params, "code");
      const messagesLimit = req.query.limit != null ? Math.min(Number(req.query.limit), 200) : 0;
      try {
        const payload = await getChatByShortCodeForUser(userId, code, messagesLimit);
        return res.json(payload);
      } catch (error) {
        if (respondChatsServiceError(res, error)) return;
        throw error;
      }
    },
  );

  app.get("/api/chats/:id", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      const chat = await getChatByIdForUser(userId, chatId);
      return res.json(chat);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      console.error("[chats] GET /api/chats/:id failed", { chatId, userId, err: error });
      throw error;
    }
  });

  app.put("/api/chats/:id/read", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const body = (req.body ?? {}) as { messageId?: string };
    const messageId = typeof body.messageId === "string" && body.messageId ? body.messageId : undefined;
    try {
      await markChatRead(chatId, userId, messageId);
      res.json({ ok: true });
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/chats", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { type = "dm", name, memberIds } = req.body ?? {};
    try {
      const chat = await createChatForUser(userId, type, name, memberIds);
      res.status(201).json(chat);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/me/chat-list-shelves", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req)!;
      const data = await getUserChatListShelvesForUser(userId);
      return res.json(data);
    } catch (e) {
      console.error("[chats] GET /api/me/chat-list-shelves", e);
      return res.status(500).json({ message: "Не удалось загрузить папки" });
    }
  });

  app.get("/api/me/composer-pulse/pending", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req)!;
      const pulses = await listUnconsumedPulsesForUser(userId);
      res.json({ pulses });
    } catch (e) {
      console.error("[composer-pulse] pending failed", e);
      res.json({ pulses: [] });
    }
  });

  app.post("/api/me/composer-pulse/:chatId/consume", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req)!;
      const chatId = param(req.params, "chatId");
      const ok = await consumeComposerPulseForChat(userId, chatId);
      res.json({ ok });
    } catch (e) {
      console.error("[composer-pulse] consume failed", e);
      res.json({ ok: false });
    }
  });

  app.get("/api/search/messages", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json([]);
    }
    const list = await searchMessagesForUser(userId, q);
    res.json(list);
  });

  app.get("/api/chats/:chatId/media", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : null;
    const limit = req.query.limit != null ? Math.min(Number(req.query.limit), 50) : 30;
    const before = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    try {
      const list = await getChatMediaForUser(userId, chatId, folderId, limit, before);
      return res.json(list);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/chats/:chatId/links", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : null;
    const limit = req.query.limit != null ? Math.min(Number(req.query.limit), 100) : 50;
    const before = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    try {
      const list = await getChatLinksForUser(userId, chatId, folderId, limit, before);
      return res.json(list);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });
}
