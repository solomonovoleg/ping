import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { inviteMoreRequests, users } from "@shared/schema";
import { storage } from "../storage";
import { getReferralProgramSettings } from "./settings";

const MSG_MAX = 2000;

export class InviteMoreRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function submitInviteMoreRequest(userId: string, messageRaw: unknown): Promise<{ id: string }> {
  const db = getDb();
  const [pending] = await db
    .select({ id: inviteMoreRequests.id })
    .from(inviteMoreRequests)
    .where(and(eq(inviteMoreRequests.userId, userId), eq(inviteMoreRequests.status, "pending")))
    .limit(1);
  if (pending) {
    throw new InviteMoreRequestError(409, "Заявка уже на рассмотрении. Мы ответим после проверки.");
  }
  const message =
    typeof messageRaw === "string" && messageRaw.trim()
      ? messageRaw.trim().slice(0, MSG_MAX)
      : null;
  const id = randomUUID();
  await db.insert(inviteMoreRequests).values({
    id,
    userId,
    message,
    status: "pending",
    bonusInvites: 3,
  });
  return { id };
}

export async function getMyPendingInviteRequest(userId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: inviteMoreRequests.id,
      message: inviteMoreRequests.message,
      createdAt: inviteMoreRequests.createdAt,
    })
    .from(inviteMoreRequests)
    .where(and(eq(inviteMoreRequests.userId, userId), eq(inviteMoreRequests.status, "pending")))
    .limit(1);
  return row ?? null;
}

export type AdminInviteMoreRow = {
  id: string;
  userId: string;
  message: string | null;
  status: string;
  createdAt: Date | null;
  bonusInvites: number;
  displayName: string | null;
  surname: string | null;
  publicId: number;
};

export async function listPendingInviteMoreRequests(limit: number): Promise<AdminInviteMoreRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: inviteMoreRequests.id,
      userId: inviteMoreRequests.userId,
      message: inviteMoreRequests.message,
      status: inviteMoreRequests.status,
      createdAt: inviteMoreRequests.createdAt,
      bonusInvites: inviteMoreRequests.bonusInvites,
      displayName: users.displayName,
      surname: users.surname,
      publicId: users.publicId,
    })
    .from(inviteMoreRequests)
    .innerJoin(users, eq(users.id, inviteMoreRequests.userId))
    .where(eq(inviteMoreRequests.status, "pending"))
    .orderBy(desc(inviteMoreRequests.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows;
}

export async function approveInviteMoreRequest(
  requestId: string,
  adminUserId: string,
  bonusRaw: unknown,
): Promise<boolean> {
  const bonus =
    typeof bonusRaw === "number" && Number.isFinite(bonusRaw)
      ? Math.min(50, Math.max(1, Math.floor(bonusRaw)))
      : 3;
  const db = getDb();
  const [row] = await db.select().from(inviteMoreRequests).where(eq(inviteMoreRequests.id, requestId)).limit(1);
  if (!row || row.status !== "pending") return false;
  const user = await storage.getUser(row.userId);
  if (!user) return false;
  const settings = await getReferralProgramSettings();
  const effective =
    user.referralLimit != null && user.referralLimit >= 0 ? user.referralLimit : settings.defaultInvites;
  const newLimit = effective + bonus;
  await storage.updateUserProfile(row.userId, { referralLimit: newLimit });
  await db
    .update(inviteMoreRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedByUserId: adminUserId,
      bonusInvites: bonus,
    })
    .where(eq(inviteMoreRequests.id, requestId));
  return true;
}

export async function rejectInviteMoreRequest(requestId: string, adminUserId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select().from(inviteMoreRequests).where(eq(inviteMoreRequests.id, requestId)).limit(1);
  if (!row || row.status !== "pending") return false;
  await db
    .update(inviteMoreRequests)
    .set({
      status: "rejected",
      reviewedAt: new Date(),
      reviewedByUserId: adminUserId,
    })
    .where(eq(inviteMoreRequests.id, requestId));
  return true;
}
