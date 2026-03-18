import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, getUserId } from "../auth/session";
import { notifyNewMessage } from "../realtime/chat";
import { notifyChatListUpdate } from "../calls/ws";
import { sendPushToUser } from "../push/send";
import { enrichMessagesWithReply } from "./reply";
import {
  getReactionsForMessageIds,
  getMyReactionsForMessageIds,
  enrichMessagesWithReactions,
  registerMessageReactionsRoutes,
} from "./reactions";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerMessagesRoutes(app: Express): void {
  app.get("/api/chats/:chatId/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 100;
    const beforeMessageId = typeof req.query.before === "string" && req.query.before ? req.query.before : undefined;
    const chatId = param(req.params, "chatId");
    const memberIds = await storage.getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) {
      res.status(403).json({ message: "Нет доступа к чату" });
      return;
    }
    const raw = await storage.getMessagesByChatId(chatId, limit, beforeMessageId);
    const withReply = await enrichMessagesWithReply(raw, (c, m) => storage.getMessage(c, m));
    const msgIds = withReply.map((m) => m.id);
    const reactionMap = process.env.DATABASE_URL
      ? await getReactionsForMessageIds(msgIds)
      : new Map<string, { emoji: string; count: number }[]>();
    const myReactionMap = process.env.DATABASE_URL
      ? await getMyReactionsForMessageIds(userId, msgIds)
      : undefined;
    const messages = enrichMessagesWithReactions(withReply, reactionMap, myReactionMap);
    res.json(messages);
  });

  if (process.env.DATABASE_URL) {
    registerMessageReactionsRoutes(app, (c, m) => storage.getMessage(c, m), (c) => storage.getChatMemberIds(c));
  }

  app.post("/api/chats/:chatId/messages", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { content, type = "text", replyToId, forwardedFromMessageId, originalChatId } = req.body ?? {};
    if (!content || typeof content !== "string") {
      res.status(400).json({ message: "content required" });
      return;
    }
    const rawType =
      type === "system" ? "system"
      : type === "voice" ? "voice"
      : type === "image" ? "image"
      : type === "video" ? "video"
      : "text";
    const chatId = param(req.params, "chatId");
    const memberIds = await storage.getChatMemberIds(chatId);
    if (!memberIds.includes(userId)) {
      res.status(403).json({ message: "Нет доступа к чату" });
      return;
    }
    let replyToIdValid: string | undefined;
    if (replyToId && typeof replyToId === "string" && replyToId.trim()) {
      const replied = await storage.getMessage(chatId, replyToId.trim());
      if (replied) replyToIdValid = replied.id;
    }
    let forwardedFromMessageIdValid: string | undefined;
    let forwardedFromSenderIdValid: string | undefined;
    let forwardedFromSenderNameValid: string | undefined;
    if (forwardedFromMessageId && typeof forwardedFromMessageId === "string" && originalChatId && typeof originalChatId === "string") {
      const origChatId = originalChatId.trim();
      const origMsgId = forwardedFromMessageId.trim();
      const memberIds = await storage.getChatMemberIds(origChatId);
      if (!memberIds.includes(userId)) {
        res.status(403).json({ message: "Нет доступа к пересылаемому сообщению" });
        return;
      }
      const origMsg = await storage.getMessage(origChatId, origMsgId);
      if (!origMsg) {
        res.status(404).json({ message: "Пересылаемое сообщение не найдено" });
        return;
      }
      forwardedFromMessageIdValid = origMsg.id;
      forwardedFromSenderIdValid = origMsg.senderId ?? undefined;
      if (origMsg.senderId) {
        const origSender = await storage.getUser(origMsg.senderId);
        forwardedFromSenderNameValid = origSender
          ? [origSender.displayName, origSender.surname].filter(Boolean).join(" ").trim() || undefined
          : undefined;
      }
    }
    const message = await storage.createMessage({
      chatId,
      senderId: userId,
      type: rawType,
      content: String(content).trim(),
      ...(replyToIdValid && { replyToId: replyToIdValid }),
      ...(forwardedFromMessageIdValid && { forwardedFromMessageId: forwardedFromMessageIdValid }),
      ...(forwardedFromSenderIdValid && { forwardedFromSenderId: forwardedFromSenderIdValid }),
      ...(forwardedFromSenderNameValid && { forwardedFromSenderName: forwardedFromSenderNameValid }),
    });
    const payload = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      replyToId: (message as { replyToId?: string | null }).replyToId ?? undefined,
      forwardedFromMessageId: (message as { forwardedFromMessageId?: string | null }).forwardedFromMessageId ?? undefined,
      forwardedFromSenderName: (message as { forwardedFromSenderName?: string | null }).forwardedFromSenderName ?? undefined,
      createdAt: (message.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    };
    notifyNewMessage(chatId, payload);
    // Обновить список чатов у всех участников (memberIds уже получен выше)
    for (const memberId of memberIds) {
      notifyChatListUpdate(memberId);
    }
    // Пуш получателям чата (кроме отправителя)
    const sender = await storage.getUser(userId);
    const senderName = [sender?.displayName, sender?.surname].filter(Boolean).join(" ") || "Новое сообщение";
    const bodyPreview = message.type === "text" ? String(message.content).slice(0, 80) : (message.type === "voice" ? "Голосовое сообщение" : "Фото/медиа");
    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      sendPushToUser(memberId, senderName, bodyPreview, { chatId }).catch(() => {});
    }
    res.status(201).json(message);
  });

  app.delete("/api/chats/:chatId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const messageId = param(req.params, "messageId");
    const msg = await storage.getMessage(chatId, messageId);
    if (!msg) {
      res.status(404).json({ message: "Сообщение не найдено" });
      return;
    }
    if (msg.senderId !== userId) {
      res.status(403).json({ message: "Можно удалить только своё сообщение" });
      return;
    }
    const deleted = await storage.deleteMessage(chatId, messageId);
    if (!deleted) {
      res.status(500).json({ message: "Не удалось удалить" });
      return;
    }
    res.status(204).end();
  });

  app.patch("/api/chats/:chatId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const chatId = param(req.params, "chatId");
    const messageId = param(req.params, "messageId");
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      res.status(400).json({ message: "content обязателен" });
      return;
    }
    const msg = await storage.getMessage(chatId, messageId);
    if (!msg) {
      res.status(404).json({ message: "Сообщение не найдено" });
      return;
    }
    if (msg.senderId !== userId) {
      res.status(403).json({ message: "Можно редактировать только своё сообщение" });
      return;
    }
    if (msg.type !== "text") {
      res.status(400).json({ message: "Редактировать можно только текстовые сообщения" });
      return;
    }
    const updated = await storage.updateMessage(chatId, messageId, content);
    if (!updated) {
      res.status(500).json({ message: "Не удалось обновить" });
      return;
    }
    res.json(updated);
  });
}
