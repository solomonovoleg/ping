import { eq, and, desc, isNull } from "drizzle-orm";
import type { VoiceTask } from "@shared/schema";
import { voiceTasks } from "@shared/schema";
import { normalizePlannerDisplayTitle } from "./db-storage-planner-title-normalize";
import type { AppDb } from "./db-app-db";

export const VOICE_OPEN_TASKS_LIMIT_MIN = 1;
export const VOICE_OPEN_TASKS_LIMIT_MAX = 100;

export function clampVoiceOpenTasksLimit(limit: number): number {
  return Math.min(VOICE_OPEN_TASKS_LIMIT_MAX, Math.max(VOICE_OPEN_TASKS_LIMIT_MIN, limit));
}

export async function dbStorageCreateVoiceTask(
  db: AppDb,
  data: { userId: string; title: string },
): Promise<VoiceTask> {
  const [row] = await db
    .insert(voiceTasks)
    .values({
      userId: data.userId,
      title: normalizePlannerDisplayTitle(data.title, "Задача"),
    })
    .returning();
  return row;
}

export async function dbStorageListOpenVoiceTasks(
  db: AppDb,
  userId: string,
  limit: number,
): Promise<VoiceTask[]> {
  return db
    .select()
    .from(voiceTasks)
    .where(and(eq(voiceTasks.userId, userId), isNull(voiceTasks.doneAt)))
    .orderBy(desc(voiceTasks.createdAt))
    .limit(clampVoiceOpenTasksLimit(limit));
}

export async function dbStorageCompleteVoiceTask(db: AppDb, userId: string, id: string): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(voiceTasks)
    .set({ doneAt: now })
    .where(and(eq(voiceTasks.id, id), eq(voiceTasks.userId, userId), isNull(voiceTasks.doneAt)))
    .returning({ id: voiceTasks.id });
  return rows.length > 0;
}
