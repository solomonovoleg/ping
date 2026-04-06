import { and, eq } from "drizzle-orm";
import { callParticipantsHistory } from "@shared/schema";
import type { getDb } from "../db";

type AppDb = ReturnType<typeof getDb>;

/** Первая строка участника звонка для пары (callId, userId), если есть. */
export async function findFirstCallParticipantId(db: AppDb, callId: string, userId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: callParticipantsHistory.id })
    .from(callParticipantsHistory)
    .where(and(eq(callParticipantsHistory.callId, callId), eq(callParticipantsHistory.userId, userId)))
    .limit(1);
  return row?.id;
}
