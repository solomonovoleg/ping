import { and, eq, lt } from "drizzle-orm";
import { messages } from "@shared/schema";
import type { getDb } from "../db";

type AppDb = ReturnType<typeof getDb>;

/** `created_at` сообщения-курсора для пагинации «старше чем». */
export async function selectMessageCreatedAtForPageCursor(
  db: AppDb,
  chatId: string,
  beforeMessageId: string,
): Promise<Date | undefined> {
  const [beforeMsg] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.id, beforeMessageId)))
    .limit(1);
  return beforeMsg?.createdAt;
}

export function messagesCreatedBefore(createdAt: Date) {
  return lt(messages.createdAt, createdAt);
}
