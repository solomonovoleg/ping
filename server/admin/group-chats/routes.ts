import type { Express, Request, Response } from "express";
import { requireAdminOrSuper } from "../middleware";
import { writeAuditLog } from "../audit";
import { storage } from "../../storage";
import { sendChatMessage } from "../../messages/service";
import { ensureChatShortCode } from "../../chats/chat-short-code";
import { generateChatInviteCode } from "../../chats/chat-invite-code";
import { avatarUploadMulter, persistAvatarUpload } from "../../upload/avatar";
import { runMulterSingle } from "../media-studio/multer-callback";

export function registerAdminGroupChatsRoutes(app: Express): void {
  app.post(
    "/api/admin/group-chats",
    requireAdminOrSuper,
    async (req: Request, res: Response) => {
      const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
      const { creatorUserId, name, avatarUrl } = req.body ?? {};

      if (!creatorUserId || typeof creatorUserId !== "string") {
        res.status(400).json({ message: "creatorUserId обязателен" });
        return;
      }

      const creator = await storage.getUser(creatorUserId.trim());
      if (!creator) {
        res.status(404).json({ message: "Пользователь-создатель не найден" });
        return;
      }

      const chatName = typeof name === "string" && name.trim() ? name.trim() : null;
      const inviteCode = generateChatInviteCode();

      try {
        const chat = await storage.createChat({
          type: "group",
          name: chatName,
        });
        await ensureChatShortCode(chat.id);

        await storage.updateChat(chat.id, {
          avatarUrl: typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : undefined,
        });

        const updatedChat = await storage.getChatById(chat.id);

        await storage.addChatMember({
          chatId: chat.id,
          userId: creator.id,
          role: "admin",
        });

        await storage.getOrCreateMainFolder(chat.id);

        // inviteCode lives outside chat metadata patch: set directly in DB.
        const { getDb } = await import("../../db");
        const { chats: chatsTable } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const db = getDb();
        await db.update(chatsTable).set({ inviteCode }).where(eq(chatsTable.id, chat.id));

        const creatorName = [creator.displayName, creator.surname]
          .filter(Boolean)
          .join(" ")
          .trim();
        const who = creatorName || "Участник";
        const title = chatName ? ` «${chatName}»` : "";
        await sendChatMessage({
          userId: creator.id,
          chatId: chat.id,
          type: "system",
          content: `${who} создал(а) группу${title}`,
        });

        await writeAuditLog({
          adminId: adminUserId,
          action: "admin.group_chat.create",
          targetType: "chat",
          targetId: chat.id,
          details: {
            creatorUserId: creator.id,
            creatorPublicId: creator.publicId,
            name: chatName,
            inviteCode,
          },
          ip: req.ip,
        });

        const origin = `${req.protocol}://${req.get("host")}`;
        const inviteLink = `${origin}/invite/${inviteCode}`;

        res.status(201).json({
          chat: {
            id: chat.id,
            type: "group",
            name: chatName,
            avatarUrl: updatedChat?.avatarUrl ?? null,
            shortCode: updatedChat?.shortCode ?? null,
            inviteCode,
            createdAt: chat.createdAt,
          },
          inviteLink,
          creator: {
            id: creator.id,
            publicId: creator.publicId,
            displayName: creator.displayName,
          },
        });
      } catch (e) {
        console.error("[admin/group-chats] create", e);
        res.status(500).json({ message: "Не удалось создать групповой чат" });
      }
    },
  );

  app.post(
    "/api/admin/group-chats/:id/avatar",
    requireAdminOrSuper,
    runMulterSingle(avatarUploadMulter, "file", "Файл слишком большой (макс. 5 МБ)"),
    async (req: Request, res: Response) => {
      const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
      const rawId = req.params.id;
      const chatId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] ?? "" : "";

      const chat = await storage.getChatById(chatId);
      if (!chat || chat.type !== "group") {
        res.status(404).json({ message: "Групповой чат не найден" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "Файл не загружен (поле file)" });
        return;
      }

      try {
        const url = await persistAvatarUpload(req.file);
        await storage.updateChat(chatId, { avatarUrl: url });

        await writeAuditLog({
          adminId: adminUserId,
          action: "admin.group_chat.avatar",
          targetType: "chat",
          targetId: chatId,
          ip: req.ip,
        });

        res.status(201).json({ url });
      } catch (e) {
        console.error("[admin/group-chats] avatar upload", e);
        res.status(500).json({ message: "Не удалось загрузить аватар чата" });
      }
    },
  );

  app.get("/api/admin/group-chats", requireAdminOrSuper, async (_req: Request, res: Response) => {
    try {
      const { getDb } = await import("../../db");
      const { chats: chatsTable, chatMembers: chatMembersTable } = await import("@shared/schema");
      const { eq, desc, inArray, sql } = await import("drizzle-orm");
      const db = getDb();
      const rows = await db
        .select()
        .from(chatsTable)
        .where(eq(chatsTable.type, "group"))
        .orderBy(desc(chatsTable.createdAt))
        .limit(100);
      const ids = rows.map((r) => r.id);
      const countRows = ids.length
        ? await db
            .select({
              chatId: chatMembersTable.chatId,
              memberCount: sql<number>`count(*)::int`,
            })
            .from(chatMembersTable)
            .where(inArray(chatMembersTable.chatId, ids))
            .groupBy(chatMembersTable.chatId)
        : [];
      const memberCountByChat = new Map<string, number>();
      for (const row of countRows) {
        memberCountByChat.set(row.chatId, Number(row.memberCount ?? 0));
      }
      const req = _req;
      const origin = `${req.protocol}://${req.get("host")}`;

      const result = rows.map((c) => ({
        ...c,
        memberCount: memberCountByChat.get(c.id) ?? 0,
        inviteLink: c.inviteCode ? `${origin}/invite/${c.inviteCode}` : null,
      }));

      res.json({ chats: result });
    } catch (e) {
      console.error("[admin/group-chats] list", e);
      res.status(500).json({ message: "Ошибка загрузки списка" });
    }
  });
}
