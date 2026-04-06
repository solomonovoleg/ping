import { and, eq } from "drizzle-orm";
import { messages } from "@shared/schema";

export function messageInChatCondition(chatId: string, messageId: string) {
  return and(eq(messages.chatId, chatId), eq(messages.id, messageId));
}
