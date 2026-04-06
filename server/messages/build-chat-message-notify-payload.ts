import type { Message } from "@shared/schema";
import type { ChatMessagePayload } from "../realtime/chat";
import { deriveVideoNotePosterUrl } from "./video-note-poster";

export function buildChatMessageNotifyPayload(message: Message): ChatMessagePayload {
  const m = message as Message & {
    folderId?: string | null;
    replyToId?: string | null;
    forwardedFromMessageId?: string | null;
    forwardedFromSenderName?: string | null;
    transcript?: string | null;
  };
  return {
    id: message.id,
    chatId: message.chatId,
    folderId: m.folderId ?? undefined,
    senderId: message.senderId ?? null,
    type: message.type,
    content: message.content,
    replyToId: m.replyToId ?? undefined,
    forwardedFromMessageId: m.forwardedFromMessageId ?? undefined,
    forwardedFromSenderName: m.forwardedFromSenderName ?? undefined,
    createdAt: (message.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    transcript: m.transcript ?? undefined,
    videoPosterUrl:
      message.type === "video_note"
        ? deriveVideoNotePosterUrl(typeof message.content === "string" ? message.content : null) ?? null
        : undefined,
  };
}
