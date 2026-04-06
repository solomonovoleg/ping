import { eq } from "drizzle-orm";
import { serviceChatThreads } from "@shared/schema";
import { getDb } from "../db";

/** Сервисные сценарии (не начисляем «личку с другом»). */
export async function isServiceDmChat(chatId: string): Promise<boolean> {
  const id = chatId.trim();
  if (!id) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ one: serviceChatThreads.id })
      .from(serviceChatThreads)
      .where(eq(serviceChatThreads.chatId, id))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}
