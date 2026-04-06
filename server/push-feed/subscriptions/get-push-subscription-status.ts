import { getPushSubscription } from "../db/push-subscriptions.queries";

export async function getPushSubscriptionStatus(params: {
  subscriberId: string;
  authorId: string;
}): Promise<{ subscribed: boolean; notificationsEnabled: boolean; hidden: boolean }> {
  return getPushSubscription(params.subscriberId, params.authorId);
}
