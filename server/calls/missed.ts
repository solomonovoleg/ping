import { getDb } from "../db";
import { storage } from "../storage";
import { missedCalls } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

/** Записать пропущенный звонок и добавить сообщение в чат */
export async function recordMissedCall(
  chatId: string,
  callerId: string,
  calleeId: string,
  video: boolean
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .insert(missedCalls)
    .values({ chatId, callerId, calleeId, video })
    .returning();
  if (!row) return;
  const content = JSON.stringify({ callerId, calleeId, video });
  await storage.createMessage({
    chatId,
    senderId: null,
    type: "missed_call",
    content,
  });
}

/** Список пропущенных звонков для пользователя (где он callee), по убыванию даты */
export async function listMissedCallsForUser(userId: string): Promise<
  { id: string; chatId: string; callerId: string; video: boolean; createdAt: Date; callerDisplayName?: string | null; callerSurname?: string | null; callerAvatarUrl?: string | null }[]
> {
  const db = getDb();
  const rows = await db
    .select({
      id: missedCalls.id,
      chatId: missedCalls.chatId,
      callerId: missedCalls.callerId,
      video: missedCalls.video,
      createdAt: missedCalls.createdAt,
    })
    .from(missedCalls)
    .where(eq(missedCalls.calleeId, userId))
    .orderBy(desc(missedCalls.createdAt))
    .limit(50);
  if (rows.length === 0) return [];
  const callerIds = Array.from(new Set(rows.map((r) => r.callerId)));
  const users = await Promise.all(callerIds.map((id) => storage.getUser(id)));
  const userMap = new Map(users.filter((u): u is NonNullable<typeof u> => !!u).map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = userMap.get(r.callerId);
    return {
      id: r.id,
      chatId: r.chatId,
      callerId: r.callerId,
      video: r.video,
      createdAt: r.createdAt,
      callerDisplayName: u?.displayName ?? null,
      callerSurname: u?.surname ?? null,
      callerAvatarUrl: u?.avatarUrl ?? null,
    };
  });
}
