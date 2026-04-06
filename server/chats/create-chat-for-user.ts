import { storage } from "../storage";
import { sendChatMessage } from "../messages/service";
import { viewerMayDmTarget } from "../users/social-policy";
import { ChatsServiceError } from "./chats-service-error";
import { ensureChatShortCode } from "./chat-short-code";
import { ensureGroupChatHasInviteCode } from "./chat-invite-code";

export async function createChatForUser(
  userId: string,
  type: unknown,
  name: unknown,
  memberIds: unknown,
) {
  const normalizedType = type === "group" ? "group" : type === "business" ? "business" : "dm";
  if (normalizedType === "dm" && Array.isArray(memberIds)) {
    for (const uid of memberIds) {
      if (uid === userId) continue;
      const otherId = String(uid);
      const other = await storage.getUser(otherId);
      if (!other || other.deletedAt) {
        throw new ChatsServiceError(404, "Пользователь не найден");
      }
      const mayDm = await viewerMayDmTarget(userId, otherId);
      if (!mayDm) {
        throw new ChatsServiceError(
          403,
          "Пользователь ограничил, кто может писать ему в личные сообщения",
        );
      }
    }
  }
  const chat = await storage.createChat({
    type: normalizedType,
    name: typeof name === "string" ? name || null : null,
  });
  if (chat.type !== "dm" && !chat.shortCode) {
    await ensureChatShortCode(chat.id);
  }
  await storage.addChatMember({ chatId: chat.id, userId, role: "admin" });
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    for (const uid of memberIds) {
      if (uid !== userId) {
        await storage.addChatMember({ chatId: chat.id, userId: String(uid), role: "member" });
      }
    }
  }
  if (chat.type === "group") {
    await storage.getOrCreateMainFolder(chat.id);
    const creator = await storage.getUser(userId);
    const creatorName =
      creator ? [creator.displayName, creator.surname].filter(Boolean).join(" ").trim() : "";
    const who = creatorName || "Участник";
    const title = typeof name === "string" && name.trim() ? ` «${name.trim()}»` : "";
    await sendChatMessage({
      userId,
      chatId: chat.id,
      type: "system",
      content: `${who} создал(а) группу${title}`,
    });
    const latest = await storage.getChatById(chat.id);
    if (latest) return ensureGroupChatHasInviteCode(latest);
  }
  return chat;
}
