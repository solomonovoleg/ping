export type CreateScheduledMessageInput = {
  chatId: string;
  folderId?: string | null;
  senderId: string;
  type: string;
  content: string;
  replyToId?: string | null;
  scheduledAt: Date;
};

/** Значения для вставки: `null` из API → `undefined` там, где колонка опциональна; контент trim. */
export function buildScheduledMessageInsertValues(data: CreateScheduledMessageInput) {
  return {
    chatId: data.chatId,
    folderId: data.folderId ?? undefined,
    senderId: data.senderId,
    type: data.type,
    content: data.content.trim(),
    replyToId: data.replyToId ?? undefined,
    scheduledAt: data.scheduledAt,
  };
}
