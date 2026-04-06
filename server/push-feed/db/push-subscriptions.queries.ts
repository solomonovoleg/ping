import { and, count, eq, inArray } from "drizzle-orm";
import { pushSubscriptions, users } from "@shared/schema";
import { getDb } from "../../db";

export async function fetchPushSubscriberIdsByAuthor(authorId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: pushSubscriptions.subscriberId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.authorId, authorId));
  return rows.map((row) => row.userId).filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function fetchPushNotificationRecipientIdsByAuthor(authorId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: pushSubscriptions.subscriberId })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.subscriberId))
    .where(
      and(
        eq(pushSubscriptions.authorId, authorId),
        eq(pushSubscriptions.hidden, false),
        eq(pushSubscriptions.notificationsEnabled, true),
        eq(users.pushFeedNotificationsEnabled, true),
      ),
    );
  return rows.map((row) => row.userId).filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function insertPushSubscription(subscriberId: string, authorId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(pushSubscriptions)
    .values({ subscriberId, authorId })
    .onConflictDoUpdate({
      target: [pushSubscriptions.subscriberId, pushSubscriptions.authorId],
      set: { hidden: false, notificationsEnabled: true },
    });
}

export async function deletePushSubscription(subscriberId: string, authorId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.subscriberId, subscriberId), eq(pushSubscriptions.authorId, authorId)));
}

export async function hasPushSubscription(subscriberId: string, authorId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.subscriberId, subscriberId), eq(pushSubscriptions.authorId, authorId)))
    .limit(1);
  return Boolean(row?.id);
}

export async function getPushSubscription(subscriberId: string, authorId: string): Promise<{
  subscribed: boolean;
  notificationsEnabled: boolean;
  hidden: boolean;
}> {
  const db = getDb();
  const [row] = await db
    .select({
      id: pushSubscriptions.id,
      notificationsEnabled: pushSubscriptions.notificationsEnabled,
      hidden: pushSubscriptions.hidden,
    })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.subscriberId, subscriberId), eq(pushSubscriptions.authorId, authorId)))
    .limit(1);
  return {
    subscribed: Boolean(row?.id),
    notificationsEnabled: row?.notificationsEnabled !== false,
    hidden: row?.hidden === true,
  };
}

export async function updatePushSubscriptionNotifications(
  subscriberId: string,
  authorId: string,
  notificationsEnabled: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(pushSubscriptions)
    .set({ notificationsEnabled })
    .where(and(eq(pushSubscriptions.subscriberId, subscriberId), eq(pushSubscriptions.authorId, authorId)));
}

export async function updatePushSubscriptionHidden(
  subscriberId: string,
  authorId: string,
  hidden: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(pushSubscriptions)
    .set({ hidden })
    .where(and(eq(pushSubscriptions.subscriberId, subscriberId), eq(pushSubscriptions.authorId, authorId)));
}

/** Подписчики с hidden=false — карточка появится у них в Чаты → Push. */
export async function countPushFeedSubscribersByAuthor(authorId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.authorId, authorId), eq(pushSubscriptions.hidden, false)));
  return Number(row?.value ?? 0) || 0;
}

/** Сколько получат push на устройство (те же фильтры, что в fanout). */
export async function countPushDeviceNotifyRecipientsByAuthor(authorId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.subscriberId))
    .where(
      and(
        eq(pushSubscriptions.authorId, authorId),
        eq(pushSubscriptions.hidden, false),
        eq(pushSubscriptions.notificationsEnabled, true),
        eq(users.pushFeedNotificationsEnabled, true),
      ),
    );
  return Number(row?.value ?? 0) || 0;
}

export async function countPushSubscriptionsByAuthors(authorIds: string[]): Promise<Map<string, number>> {
  const ids = authorIds.filter((id) => id.trim().length > 0);
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const db = getDb();
  const rows = await db
    .select({ authorId: pushSubscriptions.authorId, value: count() })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.authorId, ids))
    .groupBy(pushSubscriptions.authorId);
  for (const row of rows) out.set(row.authorId, Number(row.value ?? 0) || 0);
  return out;
}

export async function getPushFeedGlobalNotificationsEnabled(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ enabled: users.pushFeedNotificationsEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.enabled !== false;
}

export async function updatePushFeedGlobalNotificationsEnabled(userId: string, enabled: boolean): Promise<void> {
  const db = getDb();
  await db.update(users).set({ pushFeedNotificationsEnabled: enabled }).where(eq(users.id, userId));
}
