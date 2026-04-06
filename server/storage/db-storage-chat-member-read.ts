import { and, eq } from "drizzle-orm";
import type { Chat } from "@shared/schema";
import { chatMembers } from "@shared/schema";
import type { getDb } from "../db";

type AppDb = ReturnType<typeof getDb>;

/** Один запрос `last_read_at` для участника — единая точка, чтобы не разъезжали условия. */
export async function selectChatMemberLastReadAt(db: AppDb, chatId: string, userId: string): Promise<Date | null> {
  const [m] = await db
    .select({ lastReadAt: chatMembers.lastReadAt })
    .from(chatMembers)
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
    .limit(1);
  return m?.lastReadAt ?? null;
}

/** Курсор прочтения только двигается вперёд (как в зрелых мессенджерах). */
export function monotonicLastReadTimestamp(current: Date | null | undefined, incoming: Date): Date {
  if (!current || incoming > current) return incoming;
  return current;
}

export function pluckChatMemberUserIds(rows: { userId: string }[]): string[] {
  return rows.map((r) => r.userId);
}

export function chatsFromMemberJoinRows(rows: { chat: Chat }[]): Chat[] {
  return rows.map((r) => r.chat);
}
