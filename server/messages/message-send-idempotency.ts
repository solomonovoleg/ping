import { and, eq } from "drizzle-orm";
import { messageSendIdempotency } from "@shared/schema";
import { getDb } from "../db";

const KEY_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

export function normalizeClientSendIdempotencyKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s || s.length > 128 || !KEY_RE.test(s)) return undefined;
  return s;
}

export async function findExistingMessageIdBySendKey(
  userId: string,
  chatId: string,
  key: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ messageId: messageSendIdempotency.messageId })
    .from(messageSendIdempotency)
    .where(
      and(
        eq(messageSendIdempotency.userId, userId),
        eq(messageSendIdempotency.chatId, chatId),
        eq(messageSendIdempotency.idempotencyKey, key),
      ),
    )
    .limit(1);
  return row?.messageId ?? null;
}

/** @returns true если строка вставлена, false при конфликте уникального ключа */
export async function tryInsertSendIdempotencyRow(
  userId: string,
  chatId: string,
  key: string,
  messageId: string,
): Promise<boolean> {
  const db = getDb();
  const inserted = await db
    .insert(messageSendIdempotency)
    .values({ userId, chatId, idempotencyKey: key, messageId })
    .onConflictDoNothing()
    .returning({ messageId: messageSendIdempotency.messageId });
  return inserted.length > 0;
}
