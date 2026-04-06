import { asc } from "drizzle-orm";
import { scheduledMessages } from "@shared/schema";

export const scheduledMessagesDueRowSelect = {
  id: scheduledMessages.id,
  chatId: scheduledMessages.chatId,
  folderId: scheduledMessages.folderId,
  senderId: scheduledMessages.senderId,
  type: scheduledMessages.type,
  content: scheduledMessages.content,
  replyToId: scheduledMessages.replyToId,
} as const;

/** Сначала более ранние `scheduled_at`, при равенстве — стабильный порядок по `id`. */
export const SCHEDULED_MESSAGES_DUE_ORDER = [
  asc(scheduledMessages.scheduledAt),
  asc(scheduledMessages.id),
];
