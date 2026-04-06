import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { getUserId } from "../auth/session";
import { hashPassword } from "../auth/password";
import { buildUserInsertWithPhone } from "../auth/phone-at-rest";
import { createToken } from "../auth/token";
import { sendChatMessage } from "../messages/service";
import { noStorePrivateJson } from "../middleware/no-store-private-json";

function generateGuestPhone(): string {
  const rand = randomBytes(6).toString("hex");
  return `guest_${rand}_${Date.now()}`;
}

function generateGuestPassword(): string {
  return randomBytes(16).toString("base64url");
}

export function registerChatInviteRoutes(app: Express): void {
  app.get("/api/chat-invite/:code", noStorePrivateJson, async (req: Request, res: Response) => {
    const rawCode = req.params.code;
    const code = (typeof rawCode === "string" ? rawCode : "").trim();
    if (!code) {
      res.status(400).json({ message: "Код приглашения не указан" });
      return;
    }

    try {
      const chat = await storage.getChatByInviteCode(code);
      if (!chat) {
        res.status(404).json({ message: "Приглашение не найдено или недействительно" });
        return;
      }

      const memberIds = await storage.getChatMemberIds(chat.id);

      const userId = getUserId(req);
      const alreadyMember = userId ? memberIds.includes(userId) : false;

      res.json({
        chat: {
          id: chat.id,
          name: chat.name,
          avatarUrl: chat.avatarUrl,
          type: chat.type,
          memberCount: memberIds.length,
        },
        isAuthenticated: !!userId,
        alreadyMember,
      });
    } catch (e) {
      console.error("[chat-invite] info", e);
      res.status(500).json({ message: "Ошибка загрузки приглашения" });
    }
  });

  app.post("/api/chat-invite/:code/join", noStorePrivateJson, async (req: Request, res: Response) => {
    const rawCode = req.params.code;
    const code = (typeof rawCode === "string" ? rawCode : "").trim();
    if (!code) {
      res.status(400).json({ message: "Код приглашения не указан" });
      return;
    }

    try {
      const chat = await storage.getChatByInviteCode(code);
      if (!chat) {
        res.status(404).json({ message: "Приглашение не найдено или недействительно" });
        return;
      }

      let userId = getUserId(req);
      let isNewUser = false;
      let token: string | undefined;

      if (!userId) {
        const { displayName } = req.body ?? {};
        const guestName = typeof displayName === "string" && displayName.trim()
          ? displayName.trim()
          : `Гость ${Math.floor(Math.random() * 9000) + 1000}`;

        const guestPhone = generateGuestPhone();
        const guestPassword = generateGuestPassword();
        const publicId = await storage.getNextPublicId();

        const insertData = buildUserInsertWithPhone(guestPhone, {
          password: hashPassword(guestPassword),
          publicId,
        });

        const newUser = await storage.createUser(insertData);
        await storage.updateUserProfile(newUser.id, { displayName: guestName });
        userId = newUser.id;
        isNewUser = true;

        if (req.session) {
          req.session.userId = newUser.id;
          await new Promise<void>((resolve, reject) => {
            req.session!.save((err) => (err ? reject(err) : resolve()));
          });
        }
        token = createToken(newUser.id);
      }

      const existingMember = await storage.getChatMember(chat.id, userId);
      if (existingMember) {
        res.json({
          ok: true,
          chatId: chat.id,
          alreadyMember: true,
          isNewUser: false,
        });
        return;
      }

      await storage.addChatMember({
        chatId: chat.id,
        userId,
        role: "member",
      });

      const user = await storage.getUser(userId);
      const userName = user
        ? [user.displayName, user.surname].filter(Boolean).join(" ").trim() || "Участник"
        : "Участник";

      await sendChatMessage({
        userId,
        chatId: chat.id,
        type: "system",
        content: `${userName} присоединился(-ась) по ссылке`,
      });

      try {
        const { notifyChatListUpdate } = await import("../calls/ws");
        notifyChatListUpdate(userId);
      } catch {}

      res.json({
        ok: true,
        chatId: chat.id,
        alreadyMember: false,
        isNewUser,
        ...(token ? { token } : {}),
        ...(isNewUser && user
          ? {
              user: {
                id: user.id,
                publicId: user.publicId,
                displayName: user.displayName,
              },
            }
          : {}),
      });
    } catch (e) {
      console.error("[chat-invite] join", e);
      res.status(500).json({ message: "Не удалось присоединиться к чату" });
    }
  });
}
