import { storage } from "../storage";
import { enrichMessagesWithReply } from "./reply";
import {
  enrichMessagesWithReactions,
  getReactionsForMessageIdsWithMine,
} from "./reactions";
import { ensureChatAccess } from "./ensure-chat-access";
import { createPresignUrlCache, enrichListMessageOwnS3Urls } from "./enrich-message-media-s3-urls";

export async function listChatMessages(
  userId: string,
  chatId: string,
  limit: number,
  beforeMessageId?: string,
  folderId?: string | null,
) {
  await ensureChatAccess(userId, chatId);
  let resolvedFolderId = folderId;
  const chat = await storage.getChatById(chatId);
  if (chat?.type === "group" && resolvedFolderId === undefined) {
    const mainFolder = await storage.getOrCreateMainFolder(chatId);
    resolvedFolderId = mainFolder.id;
  }
  const raw = await storage.getMessagesByChatId(chatId, limit, beforeMessageId, resolvedFolderId);
  const hiddenIds = await storage.getHiddenMessageIdsForUserInChat(userId, chatId);
  const hiddenSet = new Set(hiddenIds);
  const filtered = raw.filter((m) => !hiddenSet.has(m.id));
  const withReply = await enrichMessagesWithReply(filtered, (c, ids) => storage.getMessagesByIdsInChat(c, ids));
  const msgIds = withReply.map((m) => m.id);
  const { reactionMap, myReactionMap } =
    process.env.DATABASE_URL
      ? await getReactionsForMessageIdsWithMine(userId, msgIds)
      : { reactionMap: new Map<string, { emoji: string; count: number }[]>(), myReactionMap: new Map<string, string>() };
  const withReactions = enrichMessagesWithReactions(withReply, reactionMap, myReactionMap);
  const urlCache = createPresignUrlCache();
  return Promise.all(withReactions.map((m) => enrichListMessageOwnS3Urls(m, urlCache)));
}
