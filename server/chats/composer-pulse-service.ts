import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { composerPulsePending, chats } from "@shared/schema";
import { getDb } from "../db/client";

const MAX_PENDING_AGE_DAYS = 7;

/** Только личные чаты — без групп. */
export async function isDmChat(chatId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select({ type: chats.type }).from(chats).where(eq(chats.id, chatId)).limit(1);
  return row?.type === "dm";
}

export async function enqueueComposerPulsePending(input: {
  chatId: string;
  fromUserId: string;
  toUserId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .delete(composerPulsePending)
    .where(
      and(
        eq(composerPulsePending.chatId, input.chatId),
        eq(composerPulsePending.toUserId, input.toUserId),
        isNull(composerPulsePending.consumedAt),
      ),
    );
  await db.insert(composerPulsePending).values({
    chatId: input.chatId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
  });
}

export async function listUnconsumedPulsesForUser(userId: string): Promise<
  { chatId: string; fromUserId: string; createdAt: string }[]
> {
  const db = getDb();
  const cutoff = new Date(Date.now() - MAX_PENDING_AGE_DAYS * 86400_000);
  await db.delete(composerPulsePending).where(lt(composerPulsePending.createdAt, cutoff));
  const rows = await db
    .select({
      chatId: composerPulsePending.chatId,
      fromUserId: composerPulsePending.fromUserId,
      createdAt: composerPulsePending.createdAt,
    })
    .from(composerPulsePending)
    .where(and(eq(composerPulsePending.toUserId, userId), isNull(composerPulsePending.consumedAt)))
    .orderBy(asc(composerPulsePending.createdAt));
  return rows.map((r) => ({
    chatId: r.chatId,
    fromUserId: r.fromUserId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

export async function consumeComposerPulseForChat(userId: string, chatId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .update(composerPulsePending)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(composerPulsePending.toUserId, userId),
        eq(composerPulsePending.chatId, chatId),
        isNull(composerPulsePending.consumedAt),
      ),
    )
    .returning({ id: composerPulsePending.id });
  return res.length > 0;
}
