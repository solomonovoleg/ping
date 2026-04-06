import { storage } from "../storage";
import { MessagesServiceError } from "./messages-service-error";
import { parseAndValidateChatFileMessageContent } from "./parse-chat-file-message-content";
import { parseAndValidateStructuredShareContent } from "./parse-structured-share-content";
import { normalizeMessageType } from "./normalize-message-type";
import { resolveStickerMessageContent } from "../stickers/resolve-outgoing-sticker-content";
import { ensureChatAccess } from "./ensure-chat-access";

type CreateScheduledInput = {
  userId: string;
  chatId: string;
  content: string;
  folderId?: string | null;
  type?: unknown;
  replyToId?: unknown;
  scheduledAt: string | Date;
};

export async function createScheduledMessage(input: CreateScheduledInput) {
  const { userId, chatId, content, folderId, type, replyToId, scheduledAt } = input;
  const memberIds = await ensureChatAccess(userId, chatId);
  const rawType = normalizeMessageType(type);
  const scheduledDate = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;
  if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    throw new MessagesServiceError(400, "scheduledAt должен быть в будущем");
  }
  let resolvedFolderId: string | undefined;
  const chat = await storage.getChatById(chatId);
  if (chat?.type === "dm" && memberIds.length === 2) {
    const recipientId = memberIds.find((id) => id !== userId);
    if (recipientId) {
      const recipientBlocksSender = await storage.getBlockFlags(recipientId, userId);
      if (recipientBlocksSender?.restrictChat) {
        throw new MessagesServiceError(403, "Собеседник ограничил вам переписку");
      }
    }
  }
  if (chat?.type === "group") {
    const mainFolder = await storage.getOrCreateMainFolder(chatId);
    resolvedFolderId = folderId ?? mainFolder.id;
  } else {
    resolvedFolderId = undefined;
  }
  let replyToIdValid: string | undefined;
  if (typeof replyToId === "string" && replyToId.trim()) {
    const replied = await storage.getMessage(chatId, replyToId.trim());
    if (replied) replyToIdValid = replied.id;
  }
  let schedContent = content.trim();
  if (rawType === "file") {
    schedContent = parseAndValidateChatFileMessageContent(schedContent);
  } else if (rawType === "post_share" || rawType === "comment_share" || rawType === "story_reply") {
    schedContent = parseAndValidateStructuredShareContent(rawType, schedContent);
  } else if (rawType === "sticker") {
    schedContent = await resolveStickerMessageContent(userId, schedContent);
  }
  const result = await storage.createScheduledMessage({
    chatId,
    ...(resolvedFolderId && { folderId: resolvedFolderId }),
    senderId: userId,
    type: rawType,
    content: schedContent,
    ...(replyToIdValid && { replyToId: replyToIdValid }),
    scheduledAt: scheduledDate,
  });
  return {
    id: result.id,
    chatId,
    folderId: resolvedFolderId ?? undefined,
    senderId: userId,
    type: rawType,
    content: schedContent,
    replyToId: replyToIdValid ?? undefined,
    scheduledAt: result.scheduledAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
}
