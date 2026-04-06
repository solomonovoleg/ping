import { getPushFeedGlobalNotificationsEnabled } from "../db/push-subscriptions.queries";

export async function getPushGlobalNotificationsSetting(userId: string): Promise<{ notificationsEnabled: boolean }> {
  return { notificationsEnabled: await getPushFeedGlobalNotificationsEnabled(userId) };
}
