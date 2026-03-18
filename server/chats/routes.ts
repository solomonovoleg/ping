import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, getUserId } from "../auth/session";
import { notifyChatListUpdate } from "../calls/ws";
import { enrichMessagesWithReply } from "../messages/reply";
import { getReactionsForMessageIds, getMyReactionsForMessageIds, enrichMessagesWithReactions } from "../messages/reactions";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerChatsRoutes(app: Express): void {
  function formatLastMessagePreview(msg: { type: string; content: string }): string {
    if (msg.type === "missed_call") return "Пропущенный звонок";
    if (msg.type === "post_share") return "Пересланный пост";
    if (msg.type === "voice") return "Голосовое сообщение";
    if (msg.type === "image") return "Фото";
    if (msg.type === "video") return "Видео";
    if (msg.type === "text") return msg.content.length > 60 ? msg.content.slice(0, 57) + "…" : msg.content;
    return msg.content?.slice(0, 60) ?? "";
  }

  app.get("/api/chats", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chats = await storage.getChatsForUser(userId);
    const result = [];
    for (const chat of chats) {
      const lastMsg = await storage.getLastMessage(chat.id);
      const lastMessage = lastMsg
        ? {
            type: lastMsg.type,
            content: formatLastMessagePreview(lastMsg),
            createdAt: lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : String(lastMsg.createdAt),
          }
        : null;
      if (chat.type === "dm" && !chat.name) {
        const memberIds = await storage.getChatMemberIds(chat.id);
        const otherId = memberIds.find((id) => id !== userId);
        const otherUser = otherId ? await storage.getUser(otherId) : undefined;
        let lastSeenAt: string | null = null;
        if (otherUser?.lastSeenAt) {
          const showOnlineTo = (otherUser as { showOnlineTo?: string }).showOnlineTo ?? "all";
          if (showOnlineTo === "all") lastSeenAt = (otherUser.lastSeenAt as Date).toISOString();
          else if (showOnlineTo === "followers") {
            const following = await storage.isFollowing(userId, otherId!);
            if (following) lastSeenAt = (otherUser.lastSeenAt as Date).toISOString();
          }
        }
        result.push({
          ...chat,
          name: otherUser ? [otherUser.displayName, otherUser.surname].filter(Boolean).join(" ") || null : null,
          otherMember: otherUser ? { id: otherUser.id, publicId: otherUser.publicId } : null,
          otherMemberAvatarUrl: otherUser?.avatarUrl ?? null,
          otherMemberLastSeenAt: lastSeenAt,
          lastMessage,
        });
      } else {
        result.push({ ...chat, lastMessage });
      }
    }
    res.json(result);
  });

  /** Личный чат по publicId собеседника. ?limit=N — вернуть чат и сообщения одним ответом (быстрая загрузка). */
  app.get("/api/chats/dm-by-public-id/:publicId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const publicIdNum = parseInt(param(req.params, "publicId"), 10);
    if (Number.isNaN(publicIdNum) || publicIdNum < 0) {
      res.status(400).json({ message: "Некорректный ID" });
      return;
    }
    const otherUser = await storage.getUserByPublicId(publicIdNum);
    if (!otherUser) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    if (otherUser.id === userId) {
      res.status(400).json({ message: "Нельзя открыть чат с собой" });
      return;
    }
    const chat = await storage.getOrCreateDmChat(userId, otherUser.id);
    const memberIds = await storage.getChatMemberIds(chat.id);
    const otherId = memberIds.find((id) => id !== userId);
    const other = otherId ? await storage.getUser(otherId) : undefined;
    const otherName = other ? [other.displayName, other.surname].filter(Boolean).join(" ") || null : null;
    const otherLastReadAt = otherId ? await storage.getChatMemberLastReadAt(chat.id, otherId) : null;
    let lastSeenAt: string | null = null;
    if (other?.lastSeenAt) {
      const showOnlineTo = (other as { showOnlineTo?: string }).showOnlineTo ?? "all";
      if (showOnlineTo === "all") lastSeenAt = (other.lastSeenAt as Date).toISOString();
      else if (showOnlineTo === "followers") {
        const following = await storage.isFollowing(userId, otherId!);
        if (following) lastSeenAt = (other.lastSeenAt as Date).toISOString();
      }
    }
    const chatPayload = {
      ...chat,
      name: otherName,
      otherMember: other
        ? {
            id: other.id,
            publicId: other.publicId,
            displayName: other.displayName,
            surname: other.surname,
            avatarUrl: other.avatarUrl,
            phone: other.phone ?? null,
            lastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
            lastSeenAt,
          }
        : null,
    };

    const messagesLimit = req.query.limit != null ? Math.min(Number(req.query.limit), 200) : 0;
    if (messagesLimit > 0) {
      const raw = await storage.getMessagesByChatId(chat.id, messagesLimit);
      const withReply = await enrichMessagesWithReply(raw, (c, m) => storage.getMessage(c, m));
      const msgIds = withReply.map((m) => m.id);
      const reactionMap = process.env.DATABASE_URL
        ? await getReactionsForMessageIds(msgIds)
        : new Map<string, { emoji: string; count: number }[]>();
      const myReactionMap = process.env.DATABASE_URL
        ? await getMyReactionsForMessageIds(userId, msgIds)
        : undefined;
      const messages = enrichMessagesWithReactions(withReply, reactionMap, myReactionMap);
      return res.json({ chat: chatPayload, messages });
    }
    return res.json(chatPayload);
  });

  app.get("/api/chats/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chat = await storage.getChatById(param(req.params, "id"));
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }
    const memberIds = await storage.getChatMemberIds(chat.id);
    if (!memberIds.includes(userId)) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }
    if (chat.type === "dm" && !chat.name) {
      const otherId = memberIds.find((id) => id !== userId);
      const otherUser = otherId ? await storage.getUser(otherId) : undefined;
      const otherName = otherUser ? [otherUser.displayName, otherUser.surname].filter(Boolean).join(" ") || null : null;
      const otherLastReadAt = otherId ? await storage.getChatMemberLastReadAt(chat.id, otherId) : null;
      let lastSeenAt: string | null = null;
      if (otherUser?.lastSeenAt) {
        const showOnlineTo = (otherUser as { showOnlineTo?: string }).showOnlineTo ?? "all";
        if (showOnlineTo === "all") lastSeenAt = (otherUser.lastSeenAt as Date).toISOString();
        else if (showOnlineTo === "followers") {
          const following = await storage.isFollowing(userId, otherId!);
          if (following) lastSeenAt = (otherUser.lastSeenAt as Date).toISOString();
        }
      }
      return res.json({
        ...chat,
        name: otherName,
        otherMember: otherUser
          ? {
              id: otherUser.id,
              publicId: otherUser.publicId,
              displayName: otherUser.displayName,
              surname: otherUser.surname,
              avatarUrl: otherUser.avatarUrl,
              phone: otherUser.phone ?? null,
              lastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
              lastSeenAt,
            }
          : null,
      });
    }
    res.json(chat);
  });

  app.put("/api/chats/:id/read", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "id");
    const chat = await storage.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }
    await storage.updateLastRead(chatId, userId);
    res.json({ ok: true });
  });

  app.post("/api/chats", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { type = "dm", name, memberIds } = req.body ?? {};
    const chat = await storage.createChat({ type: type === "group" ? "group" : "dm", name: name || null });
    await storage.addChatMember({ chatId: chat.id, userId, role: "admin" });
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      for (const uid of memberIds) {
        if (uid !== userId) await storage.addChatMember({ chatId: chat.id, userId: String(uid), role: "member" });
      }
    }
    res.status(201).json(chat);
  });

  app.get("/api/search/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json([]);
    }
    const list = await storage.searchMessages(userId, q, 30);
    res.json(list.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  });

  app.post("/api/chats/start-dm", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const otherUserId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    if (!otherUserId || otherUserId === userId) {
      res.status(400).json({ message: "Укажите ID пользователя для начала диалога" });
      return;
    }
    const other = await storage.getUser(otherUserId);
    if (!other) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    const chat = await storage.getOrCreateDmChat(userId, otherUserId);
    notifyChatListUpdate(otherUserId);
    const otherName = [other.displayName, other.surname].filter(Boolean).join(" ") || null;
    const otherLastReadAt = await storage.getChatMemberLastReadAt(chat.id, otherUserId);
    let lastSeenAt: string | null = null;
    if (other.lastSeenAt) {
      const showOnlineTo = (other as { showOnlineTo?: string }).showOnlineTo ?? "all";
      if (showOnlineTo === "all") lastSeenAt = (other.lastSeenAt as Date).toISOString();
      else if (showOnlineTo === "followers") {
        const following = await storage.isFollowing(userId, otherUserId);
        if (following) lastSeenAt = (other.lastSeenAt as Date).toISOString();
      }
    }
    res.status(201).json({
      ...chat,
      name: otherName,
      otherMember: {
        id: other.id,
        publicId: other.publicId,
        displayName: other.displayName,
        surname: other.surname,
        avatarUrl: other.avatarUrl,
        phone: other.phone ?? null,
        lastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
        lastSeenAt,
      },
    });
  });
}
