import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { ensureCallHistorySession } from "../call-transcripts/service";
import { storage } from "../storage";
import { isGroupCallsServerEnabled } from "./flags";
import { createOrReuseRoom, getActiveRoomIdForChat, getRoom } from "./room-runtime";

function gate(_req: Request, res: Response, next: () => void): void {
  if (!isGroupCallsServerEnabled()) {
    res.status(404).json({ message: "Групповые звонки выключены" });
    return;
  }
  next();
}

export function registerGroupCallRoutes(app: Express): void {
  app.post("/api/group-calls/rooms", requireAuth, gate, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const chatId = typeof req.body?.chatId === "string" ? req.body.chatId : "";
    const mediaType = req.body?.mediaType === "video" ? "video" as const : "audio" as const;
    if (!chatId) {
      res.status(400).json({ message: "Нужен chatId" });
      return;
    }
    const chat = await storage.getChatById(chatId);
    if (!chat || chat.type !== "group") {
      res.status(400).json({ message: "Групповой звонок только в групповом чате" });
      return;
    }
    const members = await storage.getChatMemberIds(chatId);
    if (!members.includes(userId)) {
      res.status(403).json({ message: "Вы не в этом чате" });
      return;
    }
    const { room, reused } = createOrReuseRoom({ chatId, mediaType, userId });
    if (!reused) {
      await ensureCallHistorySession({
        callId: room.roomId,
        chatId,
        mediaType,
        createdByUserId: userId,
      });
    }
    res.json({ roomId: room.roomId, mediaType: room.mediaType, reused });
  });

  app.get("/api/group-calls/chats/:chatId/active", requireAuth, gate, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const chatId = typeof req.params.chatId === "string" ? req.params.chatId : String(req.params.chatId?.[0] ?? "");
    if (!chatId) {
      res.status(400).json({ message: "Нужен chatId" });
      return;
    }
    const chat = await storage.getChatById(chatId);
    if (!chat || chat.type !== "group") {
      res.status(400).json({ message: "Некорректный чат" });
      return;
    }
    const members = await storage.getChatMemberIds(chatId);
    if (!members.includes(userId)) {
      res.status(403).json({ message: "Вы не в этом чате" });
      return;
    }
    const roomId = getActiveRoomIdForChat(chatId);
    if (!roomId) {
      res.json({ active: false as const });
      return;
    }
    const room = getRoom(roomId);
    if (!room || room.connected.size === 0) {
      res.json({ active: false as const });
      return;
    }
    res.json({
      active: true as const,
      roomId,
      mediaType: room.mediaType,
      participantCount: room.connected.size,
    });
  });
}
