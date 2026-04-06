import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import { storage } from "../storage";
import {
  addMemberToGroup,
  createChatFolderForUser,
  deleteChatFolderForUser,
  deleteChatForEveryoneForUser,
  leaveChatForUser,
  listChatFoldersForUser,
  removeMemberFromGroup,
  startDmForUser,
  updateChatFolderForUser,
  updateChatForUser,
  updateChatMemberPrefsForUser,
} from "./service";
import {
  createUserChatListCustomFolderForUser,
  deleteUserChatListCustomFolderForUser,
  updateUserChatListBuiltinTabPrefForUser,
  updateUserChatListCustomFolderForUser,
} from "./user-chat-list-shelves-service";
import { chatRouteParam as param, respondChatsServiceError } from "./chats-route-helpers";

export function registerChatsWriteRoutes(app: Express): void {
  app.post("/api/me/chat-list-shelves/custom", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const created = await createUserChatListCustomFolderForUser(userId, req.body ?? {});
      return res.status(201).json(created);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.patch(
    "/api/me/chat-list-shelves/custom/:folderId",
    noStorePrivateJson,
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const folderId = param(req.params, "folderId");
      try {
        const out = await updateUserChatListCustomFolderForUser(userId, folderId, req.body ?? {});
        return res.json(out);
      } catch (error) {
        if (respondChatsServiceError(res, error)) return;
        throw error;
      }
    },
  );

  app.delete(
    "/api/me/chat-list-shelves/custom/:folderId",
    noStorePrivateJson,
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const folderId = param(req.params, "folderId");
      try {
        const out = await deleteUserChatListCustomFolderForUser(userId, folderId);
        return res.json(out);
      } catch (error) {
        if (respondChatsServiceError(res, error)) return;
        throw error;
      }
    },
  );

  app.patch(
    "/api/me/chat-list-shelves/builtin/:tabId",
    noStorePrivateJson,
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const tabId = param(req.params, "tabId");
      try {
        const out = await updateUserChatListBuiltinTabPrefForUser(userId, tabId, req.body ?? {});
        return res.json(out);
      } catch (error) {
        if (respondChatsServiceError(res, error)) return;
        throw error;
      }
    },
  );

  app.patch("/api/chats/:id/me", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const body = (req.body ?? {}) as { pinned?: boolean; hidden?: boolean; listSection?: string };
    try {
      await updateChatMemberPrefsForUser(userId, chatId, body);
      return res.json({ ok: true });
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.delete("/api/chats/:id/me", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      await leaveChatForUser(userId, chatId);
      return res.json({ ok: true });
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.delete("/api/chats/:id/for-all", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      await deleteChatForEveryoneForUser(userId, chatId);
      return res.json({ ok: true });
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.patch("/api/chats/:id", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
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
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/chats/:id/members", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const newUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    try {
      const chat = await addMemberToGroup(userId, chatId, newUserId);
      res.status(201).json(chat);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.delete("/api/chats/:id/members/:userId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const actorUserId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const targetUserId = param(req.params, "userId");
    try {
      const chat = await removeMemberFromGroup(actorUserId, chatId, targetUserId);
      res.json(chat);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/chats/:id/folders", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      const folders = await listChatFoldersForUser(userId, chatId);
      return res.json(folders);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/chats/:id/folders", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
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
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.patch("/api/chats/:chatId/folders/:folderId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
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
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.delete("/api/chats/:chatId/folders/:folderId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const folderId = param(req.params, "folderId");
    try {
      await deleteChatFolderForUser(userId, folderId);
      return res.status(204).end();
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/chats/start-dm", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const otherUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    try {
      const chat = await startDmForUser(userId, otherUserId);
      res.status(201).json(chat);
    } catch (error) {
      if (respondChatsServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/chats/:id/pingok-scheduled-call", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    try {
      const active = await storage.getActiveDmScheduledCallForChatMember(userId, chatId);
      if (!active) {
        res.json({ active: null });
        return;
      }
      res.json({
        active: {
          id: active.id,
          fireAt: active.fireAt.toISOString(),
          title: active.title,
          createdByUserId: active.createdByUserId,
          peerUserId: active.peerUserId,
          iAmInitiator: active.iAmInitiator,
        },
      });
    } catch (e) {
      console.error("[chats] pingok-scheduled-call get", e);
      res.status(500).json({ message: "Не удалось загрузить" });
    }
  });

  app.post(
    "/api/chats/:id/pingok-scheduled-call/:callId/dismiss",
    noStorePrivateJson,
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const chatId = param(req.params, "id");
      const callId = param(req.params, "callId");
      const forBoth = req.body?.forBoth === true || req.body?.scope === "both";
      try {
        const ok = await storage.dismissDmScheduledCallForChatMember(userId, chatId, callId, { forBoth });
        if (!ok) {
          res.status(404).json({ message: "Не найдено" });
          return;
        }
        res.json({ ok: true });
      } catch (e) {
        console.error("[chats] pingok-scheduled-call dismiss", e);
        res.status(500).json({ message: "Ошибка" });
      }
    },
  );
}
