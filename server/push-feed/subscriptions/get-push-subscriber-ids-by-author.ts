import { fetchPushSubscriberIdsByAuthor } from "../db/push-subscriptions.queries";

export async function getPushSubscriberIdsByAuthor(authorId: string): Promise<string[]> {
  return fetchPushSubscriberIdsByAuthor(authorId);
}
