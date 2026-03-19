import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import {
  addMemberToGroup,
  ChatsServiceError,
  createChatForUser,
  createChatFolderForUser,
  deleteChatFolderForUser,
  getChatByIdForUser,
  getChatLinksForUser,
  getChatMediaForUser,
  getDmByPublicId,
  listChatFoldersForUser,
  listChatsForUser,
  markChatRead,
  removeMemberFromGroup,
  searchMessagesForUser,
  startDmForUser,
  updateChatFolderForUser,
  updateChatForUser,
} from "./service";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerChatsRoutes(app: Express): void {
  app.get("/api/chats", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chats = await listChatsForUser(userId);
    res.json(chats);
  });

  app.get("/api/chats/dm-by-public-id/:publicId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const publicIdNum = parseInt(param(req.params, "publicId"), 10);
    const messagesLimit = req.query.limit != null ? Math.min(Number(req.query.limit), 200) : 0;
    try {
      const payload = await getDmByPublicId(userId, publicIdNum, messagesLimit);
      return res.json(payload);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/chats/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      const chat = await getChatByIdForUser(userId, chatId);
      return res.json(chat);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("[chats] GET /api/chats/:id failed", { chatId, userId, err: error });
      throw error;
    }
  });

  app.put("/api/chats/:id/read", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      await markChatRead(chatId, userId);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/api/chats", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { type = "dm", name, memberIds } = req.body ?? {};
    const chat = await createChatForUser(userId, type, name, memberIds);
    res.status(201).json(chat);
  });

  app.get("/api/search/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json([]);
    }
    const list = await searchMessagesForUser(userId, q);
    res.json(list);
  });

  app.get("/api/chats/:chatId/media", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : null;
    const limit = req.query.limit != null ? Math.min(Number(req.query.limit), 50) : 30;
    const before = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    try {
      const list = await getChatMediaForUser(userId, chatId, folderId, limit, before);
      return res.json(list);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/chats/:chatId/links", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const folderId = typeof req.query.folderId === "string" && req.query.folderId ? req.query.folderId : null;
    const limit = req.query.limit != null ? Math.min(Number(req.query.limit), 100) : 50;
    const before = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    try {
      const list = await getChatLinksForUser(userId, chatId, folderId, limit, before);
      return res.json(list);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.patch("/api/chats/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const { name, avatarUrl } = req.body ?? {};
    try {
      const chat = await updateChatForUser(userId, chatId, {
        name: typeof name === "string" ? name.trim() || undefined : undefined,
        avatarUrl: typeof avatarUrl === "string" ? avatarUrl.trim() || undefined : undefined,
      });
      if (!chat) return res.status(404).json({ message: "Чат не найден" });
      return res.json(chat);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/chats/:id/members", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const newUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    try {
      const chat = await addMemberToGroup(userId, chatId, newUserId);
      res.status(201).json(chat);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.delete("/api/chats/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
    const actorUserId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const targetUserId = param(req.params, "userId");
    try {
      const chat = await removeMemberFromGroup(actorUserId, chatId, targetUserId);
      res.json(chat);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/chats/:id/folders", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      const folders = await listChatFoldersForUser(userId, chatId);
      return res.json(folders);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/chats/:id/folders", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ message: "name обязателен" });
    }
    try {
      const folder = await createChatFolderForUser(userId, chatId, name);
      return res.status(201).json(folder);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.patch("/api/chats/:chatId/folders/:folderId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const folderId = param(req.params, "folderId");
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ message: "name обязателен" });
    }
    try {
      const folder = await updateChatFolderForUser(userId, folderId, { name });
      return res.json(folder);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.delete("/api/chats/:chatId/folders/:folderId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const folderId = param(req.params, "folderId");
    try {
      await deleteChatFolderForUser(userId, folderId);
      return res.status(204).end();
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/chats/start-dm", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const otherUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    try {
      const chat = await startDmForUser(userId, otherUserId);
      res.status(201).json(chat);
    } catch (error) {
      if (error instanceof ChatsServiceError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  });
}
