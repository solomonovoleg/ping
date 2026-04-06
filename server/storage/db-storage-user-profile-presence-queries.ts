import { eq } from "drizzle-orm";
import type { User, UpdateProfile } from "@shared/schema";
import { users } from "@shared/schema";
import { buildUserProfileUpdatePatch } from "./db-storage-user-profile-update-patch";
import { userFcmTokenUpdateSet, userIosVoipTokenUpdateSet, userLastSeenUpdateSet } from "./db-storage-user-presence-update-sets";
import type { AppDb } from "./db-app-db";

export async function dbStorageUpdateUserProfile(
  db: AppDb,
  userId: string,
  data: UpdateProfile,
  getUserById: (id: string) => Promise<User | undefined>,
): Promise<User | undefined> {
  const update = buildUserProfileUpdatePatch(data);
  if (Object.keys(update).length === 0) return getUserById(userId);
  const [row] = await db.update(users).set(update).where(eq(users.id, userId)).returning();
  return row;
}

export async function dbStorageUpdateUserLastSeen(db: AppDb, userId: string): Promise<void> {
  await db.update(users).set(userLastSeenUpdateSet(new Date())).where(eq(users.id, userId));
}

export async function dbStorageUpdateUserFcmToken(db: AppDb, userId: string, token: string | null): Promise<void> {
  await db.update(users).set(userFcmTokenUpdateSet(token)).where(eq(users.id, userId));
}

export async function dbStorageUpdateUserIosVoipToken(db: AppDb, userId: string, token: string | null): Promise<void> {
  await db.update(users).set(userIosVoipTokenUpdateSet(token)).where(eq(users.id, userId));
}

export type AdminSetUserPublicIdResult =
  | { ok: true; user: User }
  | { ok: false; reason: "not_found" | "taken" | "invalid" };

/** Публичный ID (public_id): уникальный целочисленный номер профиля, не путать с внутренним users.id. */
export async function dbStorageAdminSetUserPublicId(
  db: AppDb,
  userId: string,
  newPublicId: number,
): Promise<AdminSetUserPublicIdResult> {
  if (!Number.isInteger(newPublicId) || newPublicId < 1 || newPublicId > 2_147_483_647) {
    return { ok: false, reason: "invalid" };
  }
  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) return { ok: false, reason: "not_found" };
  if (current.publicId === newPublicId) {
    return { ok: true, user: current };
  }
  const [rowWithPid] = await db.select({ id: users.id }).from(users).where(eq(users.publicId, newPublicId)).limit(1);
  if (rowWithPid && rowWithPid.id !== userId) {
    return { ok: false, reason: "taken" };
  }
  const [row] = await db.update(users).set({ publicId: newPublicId }).where(eq(users.id, userId)).returning();
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, user: row };
}
