import { DELETE_FOR_EVERYONE_MINUTES } from "@shared/constants";
import { storage } from "../storage";
import { notifyNewMessage, notifyMessageDeleted, notifyMessageEdited } from "../realtime/chat";
import { scheduleVoiceOrVideoNoteTranscription } from "./voice-transcribe";
import { notifyChatListUpdate } from "../calls/ws";
import { sendPushToUser } from "../push/send";
import { enrichMessagesWithReply } from "./reply";
import {
  enrichMessagesWithReactions,
  getMyReactionsForMessageIds,
  getReactionsForMessageIds,
} from "./reactions";

export class MessagesServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeMessageType(
  type: unknown
): "system" | "voice" | "image" | "video" | "video_note" | "text" | "post_share" | "story_reply" {
  if (type === "system") return "system";
  if (type === "voice") return "voice";
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (type === "video_note") return "video_note";
  if (type === "post_share") return "post_share";
  if (type === "story_reply") return "story_reply";
  return "text";
}

async function ensureChatAccess(userId: string, chatId: string): Promise<string[]> {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) {
    throw new MessagesServiceError(403, "Нет доступа к чату");
  }
  return memberIds;
}

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
  const withReply = await enrichMessagesWithReply(filtered, (c, m) => storage.getMessage(c, m));
  const msgIds = withReply.map((m) => m.id);
  const reactionMap = process.env.DATABASE_URL
    ? await getReactionsForMessageIds(msgIds)
    : new Map<string, { emoji: string; count: number }[]>();
  const myReactionMap = process.env.DATABASE_URL
    ? await getMyReactionsForMessageIds(userId, msgIds)
    : undefined;
  return enrichMessagesWithReactions(withReply, reactionMap, myReactionMap);
}

type SendMessageInput = {
  userId: string;
  chatId: string;
  content: string;
  folderId?: string | null;
  type?: unknown;
  replyToId?: unknown;
  forwardedFromMessageId?: unknown;
  originalChatId?: unknown;
};

type CreateScheduledInput = {
  userId: string;
  chatId: string;
  content: string;
  folderId?: string | null;
  type?: unknown;
  replyToId?: unknown;
  scheduledAt: string | Date;
};

export async function sendChatMessage(input: SendMessageInput) {
  const { userId, chatId, content, folderId, type, replyToId, forwardedFromMessageId, originalChatId } = input;
  const memberIds = await ensureChatAccess(userId, chatId);
  const rawType = normalizeMessageType(type);

  let resolvedFolderId: string | undefined;
  const chat = await storage.getChatById(chatId);
  if (chat?.type === "dm" && memberIds.length === 2) {
    const recipientId = memberIds.find((id) => id !== userId);
    if (recipientId) {
      const recipientBlocksSender = await storage.getBlockFlags(recipientId, userId);
      if (recipientBlocksSender?.restrictChat) {
        throw new MessagesServiceError(403, "Пользователь не принимает сообщения");
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

  let forwardedFromMessageIdValid: string | undefined;
  let forwardedFromSenderIdValid: string | undefined;
  let forwardedFromSenderNameValid: string | undefined;
  if (
    typeof forwardedFromMessageId === "string" &&
    typeof originalChatId === "string" &&
    forwardedFromMessageId.trim() &&
    originalChatId.trim()
  ) {
    const origChatId = originalChatId.trim();
    const origMsgId = forwardedFromMessageId.trim();
    const originMemberIds = await storage.getChatMemberIds(origChatId);
    if (!originMemberIds.includes(userId)) {
      throw new MessagesServiceError(403, "Нет доступа к пересылаемому сообщению");
    }
    const origMsg = await storage.getMessage(origChatId, origMsgId);
    if (!origMsg) {
      throw new MessagesServiceError(404, "Пересылаемое сообщение не найдено");
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
    ...(resolvedFolderId && { folderId: resolvedFolderId }),
    senderId: userId,
    type: rawType,
    content: content.trim(),
    ...(replyToIdValid && { replyToId: replyToIdValid }),
    ...(forwardedFromMessageIdValid && { forwardedFromMessageId: forwardedFromMessageIdValid }),
    ...(forwardedFromSenderIdValid && { forwardedFromSenderId: forwardedFromSenderIdValid }),
    ...(forwardedFromSenderNameValid && { forwardedFromSenderName: forwardedFromSenderNameValid }),
  });

  const payload = {
    id: message.id,
    chatId: message.chatId,
    folderId: (message as { folderId?: string | null }).folderId ?? undefined,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    replyToId: (message as { replyToId?: string | null }).replyToId ?? undefined,
    forwardedFromMessageId: (message as { forwardedFromMessageId?: string | null }).forwardedFromMessageId ?? undefined,
    forwardedFromSenderName: (message as { forwardedFromSenderName?: string | null }).forwardedFromSenderName ?? undefined,
    createdAt: (message.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
  };
  notifyNewMessage(chatId, payload);

  if (chat?.type === "dm") {
    import("../vibe/state-engine")
      .then((m) => m.processNewMessage(chatId))
      .catch((e) => {
        console.warn("[vibe] processNewMessage:", e instanceof Error ? e.message : e);
      });
  }

  if (rawType === "text" && content.trim()) {
    import("../ai-search/schedule")
      .then((m) => m.scheduleAiSearchIngest(userId, chatId))
      .catch(() => {});
  }

  for (const memberId of memberIds) {
    notifyChatListUpdate(memberId, { incomingMessage: { chatId, senderId: userId } });
  }

  const sender = await storage.getUser(userId);
  const senderName = [sender?.displayName, sender?.surname].filter(Boolean).join(" ") || "Новое сообщение";
  const bodyPreview =
    message.type === "text"
      ? String(message.content).slice(0, 80)
      : message.type === "system"
        ? String(message.content).slice(0, 80)
        : message.type === "voice"
          ? "Голосовое сообщение"
          : message.type === "video_note"
            ? "Видеокружок"
            : "Фото/медиа";
  for (const memberId of memberIds) {
    if (memberId === userId) continue;
    sendPushToUser(memberId, senderName, bodyPreview, { chatId }).catch(() => {});
  }
  return message;
}

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
        throw new MessagesServiceError(403, "Пользователь не принимает сообщения");
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
  const result = await storage.createScheduledMessage({
    chatId,
    ...(resolvedFolderId && { folderId: resolvedFolderId }),
    senderId: userId,
    type: rawType,
    content: content.trim(),
    ...(replyToIdValid && { replyToId: replyToIdValid }),
    scheduledAt: scheduledDate,
  });
  return {
    id: result.id,
    chatId,
    folderId: resolvedFolderId ?? undefined,
    senderId: userId,
    type: rawType,
    content: content.trim(),
    replyToId: replyToIdValid ?? undefined,
    scheduledAt: result.scheduledAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export async function deleteOwnMessage(
  userId: string,
  chatId: string,
  messageId: string,
  forEveryone?: boolean,
) {
  const msg = await storage.getMessage(chatId, messageId);
  if (!msg) {
    throw new MessagesServiceError(404, "Сообщение не найдено");
  }
  if (msg.senderId !== userId) {
    throw new MessagesServiceError(403, "Можно удалить только своё сообщение");
  }
  const createdAt = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
  const ageMinutes = (Date.now() - createdAt.getTime()) / 60_000;
  if (forEveryone && ageMinutes <= DELETE_FOR_EVERYONE_MINUTES) {
    const deleted = await storage.deleteMessage(chatId, messageId);
    if (!deleted) {
      throw new MessagesServiceError(500, "Не удалось удалить");
    }
    notifyMessageDeleted(chatId, messageId);
  } else {
    await storage.addMessageHidden(userId, chatId, messageId);
  }
}

/** Обработать просроченные отложенные сообщения (вызывается воркером). */
export async function processScheduledMessages(): Promise<number> {
  const due = await storage.getScheduledMessagesDue(50);
  let processed = 0;
  for (const sm of due) {
    try {
      const message = await storage.createMessage({
        chatId: sm.chatId,
        ...(sm.folderId && { folderId: sm.folderId }),
        senderId: sm.senderId ?? undefined,
        type: sm.type as "text" | "voice" | "image" | "video" | "video_note",
        content: sm.content,
        ...(sm.replyToId && { replyToId: sm.replyToId }),
      });
      await storage.deleteScheduledMessage(sm.id);
      const payload = {
        id: message.id,
        chatId: message.chatId,
        folderId: (message as { folderId?: string | null }).folderId ?? undefined,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        replyToId: (message as { replyToId?: string | null }).replyToId ?? undefined,
        createdAt: (message.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
      };
      notifyNewMessage(sm.chatId, payload);
      if ((sm.type === "voice" || sm.type === "video_note") && process.env.DATABASE_URL) {
        scheduleVoiceOrVideoNoteTranscription(sm.chatId, message.id);
      }
      const memberIds = await storage.getChatMemberIds(sm.chatId);
      for (const mid of memberIds) {
        notifyChatListUpdate(mid);
      }
      const sender = sm.senderId ? await storage.getUser(sm.senderId) : null;
      const senderName = sender ? [sender.displayName, sender.surname].filter(Boolean).join(" ") || "Новое сообщение" : "Новое сообщение";
      const bodyPreview =
        sm.type === "text"
          ? String(sm.content).slice(0, 80)
          : sm.type === "voice"
            ? "Голосовое сообщение"
            : sm.type === "video_note"
              ? "Видеокружок"
              : "Фото/медиа";
      for (const memberId of memberIds) {
        if (memberId === sm.senderId) continue;
        sendPushToUser(memberId, senderName, bodyPreview, { chatId: sm.chatId }).catch(() => {});
      }
      processed++;
    } catch (err) {
      console.warn(`[scheduled] failed to process ${sm.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
  return processed;
}

export async function editOwnTextMessage(
  userId: string,
  chatId: string,
  messageId: string,
  content: string,
) {
  const msg = await storage.getMessage(chatId, messageId);
  if (!msg) {
    throw new MessagesServiceError(404, "Сообщение не найдено");
  }
  if (msg.senderId !== userId) {
    throw new MessagesServiceError(403, "Можно редактировать только своё сообщение");
  }
  if (msg.type !== "text") {
    throw new MessagesServiceError(400, "Редактировать можно только текстовые сообщения");
  }
  const updated = await storage.updateMessage(chatId, messageId, content);
  if (!updated) {
    throw new MessagesServiceError(500, "Не удалось обновить");
  }
  notifyMessageEdited(chatId, updated.id, updated.content);
  return updated;
}
