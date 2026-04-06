import { storage } from "../storage";
import { deriveVideoNotePosterUrl } from "../messages/video-note-poster";
import { enrichMessagesWithReply } from "../messages/reply";
import {
  enrichMessagesWithReactions,
  getReactionsForMessageIdsWithMine,
} from "../messages/reactions";
import { ChatsServiceError } from "./chats-service-error";
import { getChatByIdForUser } from "./get-chat-by-id";

const CHAT_SHORT_CODE_RE = /^[a-z0-9]{4,12}$/;

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export async function getChatByShortCodeForUser(userId: string, shortCodeRaw: string, messagesLimit: number) {
  const shortCode = normalizeCode(shortCodeRaw);
  if (!CHAT_SHORT_CODE_RE.test(shortCode)) {
    throw new ChatsServiceError(400, "Некорректный shortCode");
  }
  const chat = await storage.getChatByShortCode(shortCode);
  if (!chat) {
    throw new ChatsServiceError(404, "Чат не найден");
  }

  const chatPayload = await getChatByIdForUser(userId, chat.id);

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
