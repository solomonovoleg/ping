import { updatePushFeedGlobalNotificationsEnabled } from "../db/push-subscriptions.queries";

export async function updatePushGlobalNotificationsSetting(params: {
  userId: string;
  notificationsEnabled: boolean;
}): Promise<void> {
  await updatePushFeedGlobalNotificationsEnabled(params.userId, params.notificationsEnabled);
}
