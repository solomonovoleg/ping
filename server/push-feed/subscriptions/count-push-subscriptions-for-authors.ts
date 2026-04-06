import { countPushSubscriptionsByAuthors } from "../db/push-subscriptions.queries";

export async function countPushSubscriptionsForAuthors(authorIds: string[]): Promise<Map<string, number>> {
  return countPushSubscriptionsByAuthors(authorIds);
}
