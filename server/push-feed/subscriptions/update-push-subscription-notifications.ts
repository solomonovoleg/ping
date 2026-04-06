import { updatePushSubscriptionNotifications } from "../db/push-subscriptions.queries";

export async function updateAuthorPushNotifications(params: {
  subscriberId: string;
  authorId: string;
  notificationsEnabled: boolean;
}): Promise<void> {
  await updatePushSubscriptionNotifications(params.subscriberId, params.authorId, params.notificationsEnabled);
}
