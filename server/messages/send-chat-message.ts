import { storage } from "../storage";
import {
  scheduleApiHubBridgeNewMessage,
} from "../integrations/api-hub-bridge";
import { notifyNewMessage } from "../realtime/chat";
import { notifyChatListUpdate } from "../calls/ws";
import { shouldSkipChatDmPushForRecipient } from "../chats/chat-message-push-folder-mute";
import { sendPushToUser } from "../push/send";
import { buildDmPushPayload } from "../push/chat-message-push";
import { ensureServiceChatReplyAllowed } from "../service-chat/service";
import { touchStoryFeedBoostReply } from "../stories/service";
import { MessagesServiceError } from "./messages-service-error";
import { parseAndValidateChatFileMessageContent } from "./parse-chat-file-message-content";
import { parseAndValidateStructuredShareContent } from "./parse-structured-share-content";
import { resolveStickerMessageContent } from "../stickers/resolve-outgoing-sticker-content";
import { normalizeMessageType } from "./normalize-message-type";
import { ensureChatAccess } from "./ensure-chat-access";
import { buildChatMessageNotifyPayload } from "./build-chat-message-notify-payload";
import { enrichChatMessagePayloadOwnS3Urls, enrichListMessageOwnS3Urls } from "./enrich-message-media-s3-urls";
import {
  findExistingMessageIdBySendKey,
  normalizeClientSendIdempotencyKey,
  tryInsertSendIdempotencyRow,
} from "./message-send-idempotency";
import type { Message } from "@shared/schema";

type SendMessageInput = {
  userId: string;
  chatId: string;
  content: string;
  folderId?: string | null;
  type?: unknown;
  replyToId?: unknown;
  forwardedFromMessageId?: unknown;
  originalChatId?: unknown;
  /** Заголовок Idempotency-Key или поле тела — повтор с тем же ключом вернёт то же сообщение */
  idempotencyKey?: unknown;
};

/** Вставка idempotency; при конфликте удаляет только что созданное сообщение и возвращает каноническое. */
async function reconcileSendIdempotency(
  userId: string,
  chatId: string,
  key: string,
  message: Message,
): Promise<Message> {
  const inserted = await tryInsertSendIdempotencyRow(userId, chatId, key, message.id);
  if (inserted) return message;
  const winnerId = await findExistingMessageIdBySendKey(userId, chatId, key);
  if (winnerId && winnerId !== message.id) {
    await storage.deleteMessage(chatId, message.id);
    const existing = await storage.getMessage(chatId, winnerId);
    if (existing) return existing;
  }
  return message;
}

export async function sendChatMessage(input: SendMessageInput) {
  const {
    userId,
    chatId,
    content,
    folderId,
    type,
    replyToId,
    forwardedFromMessageId,
    originalChatId,
    idempotencyKey,
  } = input;
  const memberIds = await ensureChatAccess(userId, chatId);
  const rawType = normalizeMessageType(type);
  let outContent = content.trim();
  if (rawType === "text" && !outContent) {
    throw new MessagesServiceError(400, "Пустое сообщение отправить нельзя");
  }
  if (rawType === "file") {
    outContent = parseAndValidateChatFileMessageContent(outContent);
  } else if (rawType === "post_share" || rawType === "comment_share" || rawType === "story_reply") {
    outContent = parseAndValidateStructuredShareContent(rawType, outContent);
  } else if (rawType === "sticker") {
    outContent = await resolveStickerMessageContent(userId, outContent);
  }

  const idem = process.env.DATABASE_URL ? normalizeClientSendIdempotencyKey(idempotencyKey) : undefined;
  if (idem) {
    const existingId = await findExistingMessageIdBySendKey(userId, chatId, idem);
    if (existingId) {
      const early = await storage.getMessage(chatId, existingId);
      if (early) return early;
    }
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
    await ensureServiceChatReplyAllowed(chatId, userId);
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

  let message = await storage.createMessage({
    chatId,
    ...(resolvedFolderId && { folderId: resolvedFolderId }),
    senderId: userId,
    type: rawType,
    content: outContent,
    ...(replyToIdValid && { replyToId: replyToIdValid }),
    ...(forwardedFromMessageIdValid && { forwardedFromMessageId: forwardedFromMessageIdValid }),
    ...(forwardedFromSenderIdValid && { forwardedFromSenderId: forwardedFromSenderIdValid }),
    ...(forwardedFromSenderNameValid && { forwardedFromSenderName: forwardedFromSenderNameValid }),
  });

  const newMessageId = message.id;
  if (idem) {
    message = await reconcileSendIdempotency(userId, chatId, idem, message);
  }
  const duplicateReplay = Boolean(idem) && message.id !== newMessageId;

  if (duplicateReplay) {
    return await enrichListMessageOwnS3Urls(message);
  }

  const payload = await enrichChatMessagePayloadOwnS3Urls(buildChatMessageNotifyPayload(message));
  notifyNewMessage(chatId, payload);
  scheduleApiHubBridgeNewMessage(chatId, payload, memberIds);
  if (chat?.type === "business") {
    import("../business-chat/service")
      .then((m) =>
        m.onBusinessChatUserMessage({
          chatId,
          senderId: userId,
          messageId: payload.id,
          type: payload.type,
          content: payload.content,
          createdAt: payload.createdAt,
        }),
      )
      .catch((e) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[business-chat] outbound enqueue:", e instanceof Error ? e.message : e);
        }
      });
  }

  if (rawType === "story_reply") {
    try {
      const parsed = JSON.parse(content.trim()) as { storyId?: unknown };
      const sid = typeof parsed.storyId === "string" ? parsed.storyId.trim() : "";
      if (sid) {
        void touchStoryFeedBoostReply(sid).catch((err) => {
          console.warn("[story-feed-boost] touchStoryFeedBoostReply failed", {
            storyId: sid,
            err: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } catch {
      /* контент не JSON — буст ленты не применяем */
    }
  }

  if (chat?.type === "dm") {
    import("../vibe/state-engine")
      .then((m) => m.processNewMessage(chatId))
      .catch((e) => {
        console.warn("[vibe] processNewMessage:", e instanceof Error ? e.message : e);
      });
    if (rawType === "text") {
      import("../vibe/tension-pulse")
        .then((m) => m.maybeNotifyChatVibeTensionPulse(chatId, userId))
        .catch((e) => {
          console.warn("[vibe] tension-pulse:", e instanceof Error ? e.message : e);
        });
    }
  }

  if (rawType === "text" && content.trim()) {
    import("../ai-search/schedule")
      .then((m) => m.scheduleAiSearchIngest(userId, chatId))
      .catch((err) => {
        console.error("[ai-search] scheduleAiSearchIngest failed", {
          userId,
          chatId,
          err: err instanceof Error ? err.message : String(err),
        });
      });
  }

  void import("../edge-money-chat-messages/handle-user-chat-message-for-money")
    .then((m) =>
      m.handleUserChatMessageForEdgeMoney({
        userId,
        chatId,
        chatType: chat?.type,
        memberCount: memberIds.length,
        messageType: rawType,
      }),
    )
    .catch((e) => console.error("[edge-money-chat-messages]", e));

  for (const memberId of memberIds) {
    notifyChatListUpdate(memberId, { incomingMessage: { chatId, senderId: userId } });
  }

  const sender = await storage.getUser(userId);
  const senderName = [sender?.displayName, sender?.surname].filter(Boolean).join(" ") || "Новое сообщение";
  const push = buildDmPushPayload(message.type, String(message.content ?? ""), senderName);
  for (const memberId of memberIds) {
    if (memberId === userId) continue;
    void shouldSkipChatDmPushForRecipient(memberId, chatId)
      .then((skip) => {
        if (skip) return;
        return sendPushToUser(
          memberId,
          push.title,
          push.body,
          { chatId, ...push.dataFields },
          { androidChannelId: push.androidChannelId, iosSound: push.iosSound },
        ).then((r) => {
          if (!r.ok) {
            console.warn("[push] chat_message: не отправлено", { recipientId: memberId, chatId, reason: r.reason });
          }
        });
      })
      .catch((err) => {
        console.error("[push] chat_message: chain failed", {
          recipientId: memberId,
          chatId,
          err: err instanceof Error ? err.message : String(err),
        });
      });
  }
  return await enrichListMessageOwnS3Urls(message);
}
