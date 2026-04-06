import { eq, and, asc, lte, isNull } from "drizzle-orm";
import type { UserReminder } from "@shared/schema";
import { userReminders } from "@shared/schema";
import { normalizePlannerDisplayTitle } from "./db-storage-planner-title-normalize";
import type { AppDb } from "./db-app-db";

/** Лимит строк за один запрос списка «готовых» напоминаний (как у воркеров в крупных мессенджерах — предсказуемый батч). */
export const USER_REMINDERS_DUE_LIMIT = 50;

export async function dbStorageCreateUserReminder(
  db: AppDb,
  data: { userId: string; title: string; fireAt: Date },
): Promise<UserReminder> {
  const [row] = await db
    .insert(userReminders)
    .values({
      userId: data.userId,
      title: normalizePlannerDisplayTitle(data.title, "Напоминание"),
      fireAt: data.fireAt,
    })
    .returning();
  return row;
}

export async function dbStorageListDueUserReminders(
  db: AppDb,
  userId: string,
  before: Date,
): Promise<UserReminder[]> {
  return db
    .select()
    .from(userReminders)
    .where(
      and(
        eq(userReminders.userId, userId),
        isNull(userReminders.dismissedAt),
        lte(userReminders.fireAt, before),
      ),
    )
    .orderBy(asc(userReminders.fireAt))
    .limit(USER_REMINDERS_DUE_LIMIT);
}

export async function dbStorageDismissUserReminder(
  db: AppDb,
  userId: string,
  id: string,
): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(userReminders)
    .set({ dismissedAt: now })
    .where(and(eq(userReminders.id, id), eq(userReminders.userId, userId), isNull(userReminders.dismissedAt)))
    .returning({ id: userReminders.id });
  return rows.length > 0;
}

export async function dbStorageUpdateUserReminderFireAt(
  db: AppDb,
  userId: string,
  id: string,
  fireAt: Date,
): Promise<boolean> {
  const rows = await db
    .update(userReminders)
    .set({ fireAt })
    .where(and(eq(userReminders.id, id), eq(userReminders.userId, userId), isNull(userReminders.dismissedAt)))
    .returning({ id: userReminders.id });
  return rows.length > 0;
}
