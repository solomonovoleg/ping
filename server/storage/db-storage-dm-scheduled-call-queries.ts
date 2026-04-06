import { eq, and, desc, asc, gt, lte, or, isNull } from "drizzle-orm";
import { dmScheduledCalls } from "@shared/schema";
import { normalizePlannerDisplayTitle } from "./db-storage-planner-title-normalize";
import {
  DM_PLANNER_ACTIVE_CUTOFF_PAST_MS,
  DM_SCHEDULED_CALL_ACTIVE_GRACE_MS,
  DM_SCHEDULED_CALL_CANDIDATE_LIMIT,
  DM_SCHEDULED_CALL_PRE_EVENT_WINDOW_MS,
  pickActiveDmScheduledCallForMember,
} from "./db-storage-dm-scheduled-call-helpers";
import type { AppDb } from "./db-app-db";

export const DM_SCHEDULED_PRE_EVENT_LIST_LIMIT = 20;

export async function dbStorageCreateDmScheduledCall(
  db: AppDb,
  data: {
    chatId: string;
    createdByUserId: string;
    peerUserId: string;
    fireAt: Date;
    title: string;
    plannerReminderId?: string | null;
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(dmScheduledCalls)
    .values({
      chatId: data.chatId,
      createdByUserId: data.createdByUserId,
      peerUserId: data.peerUserId,
      fireAt: data.fireAt,
      title: normalizePlannerDisplayTitle(data.title, "Звонок"),
      plannerReminderId: data.plannerReminderId ?? null,
    })
    .returning({ id: dmScheduledCalls.id });
  if (!row) throw new Error("insert dm_scheduled_calls failed");
  return row;
}

export async function dbStorageGetActiveDmScheduledCallForChatMember(
  db: AppDb,
  userId: string,
  chatId: string,
  getChatMemberIds: (cid: string) => Promise<string[]>,
): Promise<{
  id: string;
  fireAt: Date;
  title: string;
  createdByUserId: string;
  peerUserId: string;
  iAmInitiator: boolean;
} | null> {
  const memberIds = await getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) return null;
  const now = Date.now();
  const rows = await db
    .select()
    .from(dmScheduledCalls)
    .where(
      and(
        eq(dmScheduledCalls.chatId, chatId),
        or(
          and(eq(dmScheduledCalls.createdByUserId, userId), isNull(dmScheduledCalls.initiatorDismissedAt)),
          and(eq(dmScheduledCalls.peerUserId, userId), isNull(dmScheduledCalls.peerDismissedAt)),
        ),
      ),
    )
    .orderBy(desc(dmScheduledCalls.fireAt))
    .limit(DM_SCHEDULED_CALL_CANDIDATE_LIMIT);
  return pickActiveDmScheduledCallForMember(rows, userId, now, DM_SCHEDULED_CALL_ACTIVE_GRACE_MS);
}

export async function dbStorageDismissDmScheduledCallForChatMember(
  db: AppDb,
  userId: string,
  chatId: string,
  rowId: string,
  options: { forBoth: boolean },
  getChatMemberIds: (cid: string) => Promise<string[]>,
): Promise<boolean> {
  const memberIds = await getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) return false;
  const [row] = await db
    .select()
    .from(dmScheduledCalls)
    .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
    .limit(1);
  if (!row) return false;
  const isInitiator = row.createdByUserId === userId;
  const isPeer = row.peerUserId === userId;
  if (!isInitiator && !isPeer) return false;
  const now = new Date();
  if (options.forBoth) {
    const upd = await db
      .update(dmScheduledCalls)
      .set({ initiatorDismissedAt: now, peerDismissedAt: now })
      .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
      .returning({ id: dmScheduledCalls.id });
    return upd.length > 0;
  }
  if (isInitiator) {
    const upd = await db
      .update(dmScheduledCalls)
      .set({ initiatorDismissedAt: now })
      .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
      .returning({ id: dmScheduledCalls.id });
    return upd.length > 0;
  }
  const upd = await db
    .update(dmScheduledCalls)
    .set({ peerDismissedAt: now })
    .where(and(eq(dmScheduledCalls.id, rowId), eq(dmScheduledCalls.chatId, chatId)))
    .returning({ id: dmScheduledCalls.id });
  return upd.length > 0;
}

export async function dbStorageListPlannerActiveDmScheduledCalls(
  db: AppDb,
  userId: string,
): Promise<
  Array<{
    id: string;
    chatId: string;
    peerUserId: string;
    fireAt: Date;
    title: string;
    plannerReminderId: string | null;
  }>
> {
  const cutoff = new Date(Date.now() - DM_PLANNER_ACTIVE_CUTOFF_PAST_MS);
  return db
    .select({
      id: dmScheduledCalls.id,
      chatId: dmScheduledCalls.chatId,
      peerUserId: dmScheduledCalls.peerUserId,
      fireAt: dmScheduledCalls.fireAt,
      title: dmScheduledCalls.title,
      plannerReminderId: dmScheduledCalls.plannerReminderId,
    })
    .from(dmScheduledCalls)
    .where(
      and(
        eq(dmScheduledCalls.createdByUserId, userId),
        isNull(dmScheduledCalls.initiatorDismissedAt),
        gt(dmScheduledCalls.fireAt, cutoff),
      ),
    )
    .orderBy(asc(dmScheduledCalls.fireAt));
}

export async function dbStorageUpdateDmScheduledCallFireAsPlanner(
  db: AppDb,
  userId: string,
  rowId: string,
  fireAt: Date,
  title: string,
  updateUserReminderFireAt: (uid: string, reminderId: string, at: Date) => Promise<boolean>,
): Promise<{ chatId: string; peerUserId: string } | null> {
  const [row] = await db
    .select()
    .from(dmScheduledCalls)
    .where(
      and(
        eq(dmScheduledCalls.id, rowId),
        eq(dmScheduledCalls.createdByUserId, userId),
        isNull(dmScheduledCalls.initiatorDismissedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(dmScheduledCalls)
    .set({ fireAt, title: normalizePlannerDisplayTitle(title, row.title) })
    .where(eq(dmScheduledCalls.id, rowId));
  if (row.plannerReminderId) {
    await updateUserReminderFireAt(userId, row.plannerReminderId, fireAt);
  }
  return { chatId: row.chatId, peerUserId: row.peerUserId };
}

export async function dbStorageCancelDmScheduledCallAsPlanner(
  db: AppDb,
  userId: string,
  rowId: string,
  dismissUserReminder: (uid: string, reminderId: string) => Promise<boolean>,
): Promise<{ chatId: string; peerUserId: string } | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(dmScheduledCalls)
    .where(
      and(
        eq(dmScheduledCalls.id, rowId),
        eq(dmScheduledCalls.createdByUserId, userId),
        isNull(dmScheduledCalls.initiatorDismissedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(dmScheduledCalls)
    .set({ initiatorDismissedAt: now, peerDismissedAt: now })
    .where(eq(dmScheduledCalls.id, rowId));
  if (row.plannerReminderId) {
    await dismissUserReminder(userId, row.plannerReminderId);
  }
  return { chatId: row.chatId, peerUserId: row.peerUserId };
}

export async function dbStorageListDmScheduledCallsInPreEventWindow(
  db: AppDb,
  userId: string,
): Promise<Array<{ id: string; chatId: string; title: string; fireAt: Date }>> {
  const now = new Date();
  const until = new Date(now.getTime() + DM_SCHEDULED_CALL_PRE_EVENT_WINDOW_MS);
  const rows = await db
    .select({
      id: dmScheduledCalls.id,
      chatId: dmScheduledCalls.chatId,
      title: dmScheduledCalls.title,
      fireAt: dmScheduledCalls.fireAt,
    })
    .from(dmScheduledCalls)
    .where(
      and(
        gt(dmScheduledCalls.fireAt, now),
        lte(dmScheduledCalls.fireAt, until),
        or(
          and(eq(dmScheduledCalls.createdByUserId, userId), isNull(dmScheduledCalls.initiatorDismissedAt)),
          and(eq(dmScheduledCalls.peerUserId, userId), isNull(dmScheduledCalls.peerDismissedAt)),
        ),
      ),
    )
    .orderBy(asc(dmScheduledCalls.fireAt))
    .limit(DM_SCHEDULED_PRE_EVENT_LIST_LIMIT);
  return rows;
}
