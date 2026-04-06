import { storage } from "../storage";
import { notifyNewMessage } from "../realtime/chat";
import { notifyChatListUpdate } from "../calls/ws";
import { shouldSkipChatDmPushForRecipient } from "../chats/chat-message-push-folder-mute";
import { sendPushToUser } from "../push/send";
import { buildDmPushPayload } from "../push/chat-message-push";
import { buildChatMessageNotifyPayload } from "./build-chat-message-notify-payload";
import { enrichChatMessagePayloadOwnS3Urls } from "./enrich-message-media-s3-urls";

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
        type: sm.type as
          | "text"
          | "voice"
          | "image"
          | "video"
          | "video_note"
          | "file"
          | "post_share"
          | "comment_share"
          | "story_reply",
        content: sm.content,
        ...(sm.replyToId && { replyToId: sm.replyToId }),
      });
      await storage.deleteScheduledMessage(sm.id);
      const payload = await enrichChatMessagePayloadOwnS3Urls(buildChatMessageNotifyPayload(message));
      notifyNewMessage(sm.chatId, payload);
      const memberIds = await storage.getChatMemberIds(sm.chatId);
      for (const mid of memberIds) {
        notifyChatListUpdate(mid);
      }
      const sender = sm.senderId ? await storage.getUser(sm.senderId) : null;
      const senderName = sender ? [sender.displayName, sender.surname].filter(Boolean).join(" ") || "Новое сообщение" : "Новое сообщение";
      const push = buildDmPushPayload(String(sm.type), String(sm.content ?? ""), senderName);
      for (const memberId of memberIds) {
        if (memberId === sm.senderId) continue;
        void shouldSkipChatDmPushForRecipient(memberId, sm.chatId)
          .then((skip) => {
            if (skip) return;
            return sendPushToUser(
              memberId,
              push.title,
              push.body,
              { chatId: sm.chatId, ...push.dataFields },
              { androidChannelId: push.androidChannelId, iosSound: push.iosSound },
            ).then((r) => {
              if (!r.ok) {
                console.warn("[push] scheduled_message: не отправлено", { memberId, chatId: sm.chatId, reason: r.reason });
              }
            });
          })
          .catch((err) => {
            console.error("[push] scheduled_message: chain failed", {
              memberId,
              chatId: sm.chatId,
              err: err instanceof Error ? err.message : String(err),
            });
          });
      }
      processed++;
    } catch (err) {
      console.warn(`[scheduled] failed to process ${sm.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
  return processed;
}
