import { storage } from "../storage";
import { deriveVideoNotePosterUrl } from "../messages/video-note-poster";
import { enrichMessagesWithReply } from "../messages/reply";
import {
  enrichMessagesWithReactions,
  getReactionsForMessageIdsWithMine,
} from "../messages/reactions";
import { viewerMayDmTarget } from "../users/social-policy";
import { ChatsServiceError } from "./chats-service-error";
import { buildDmChatPayload } from "./chat-dm-payload";

export async function getDmByPublicId(userId: string, publicIdNum: number, messagesLimit: number) {
  if (Number.isNaN(publicIdNum) || publicIdNum < 0) {
    throw new ChatsServiceError(400, "Некорректный ID");
  }
  const otherUser = await storage.getUserByPublicId(publicIdNum);
  if (!otherUser) {
    throw new ChatsServiceError(404, "Пользователь не найден");
  }
  if (otherUser.id === userId) {
    // 409 — не «битый ID»; клиент показывает текст из message (не путать с 404 «пользователь не найден»).
    throw new ChatsServiceError(409, "Это ваш ID в Ping. Откройте диалог из списка чатов или выберите другого человека.");
  }
  const mayDm = await viewerMayDmTarget(userId, otherUser.id);
  if (!mayDm) {
    throw new ChatsServiceError(
      403,
      "Пользователь ограничил, кто может писать ему в личные сообщения",
    );
  }
  const chat = await storage.getOrCreateDmChat(userId, otherUser.id);
  const memberIds = await storage.getChatMemberIds(chat.id);
  const memberSet = new Set(memberIds);
  if (
    memberSet.size !== 2 ||
    !memberSet.has(userId) ||
    !memberSet.has(otherUser.id)
  ) {
    throw new ChatsServiceError(403, "Нет доступа к чату");
  }
  const chatPayload = await buildDmChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);

  if (messagesLimit > 0) {
    const effectiveLimit = Math.min(200, Math.max(1, messagesLimit));
    const raw = await storage.getMessagesByChatId(chat.id, effectiveLimit);
    const withReply = await enrichMessagesWithReply(raw, (c, ids) => storage.getMessagesByIdsInChat(c, ids));
    const msgIds = withReply.map((m) => m.id);
    const { reactionMap, myReactionMap } =
      process.env.DATABASE_URL
        ? await getReactionsForMessageIdsWithMine(userId, msgIds)
        : { reactionMap: new Map<string, { emoji: string; count: number }[]>(), myReactionMap: new Map<string, string>() };
    const messages = enrichMessagesWithReactions(withReply, reactionMap, myReactionMap).map((m) =>
      m.type === "video_note"
        ? { ...m, videoPosterUrl: deriveVideoNotePosterUrl(typeof m.content === "string" ? m.content : null) ?? undefined }
        : m
    );
    return { chat: chatPayload, messages };
  }
  return chatPayload;
}
